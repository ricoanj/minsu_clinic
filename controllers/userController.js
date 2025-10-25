import { User, Appointment, Handout, Notification, Medicine } from "../models/index.js";
import bcrypt from 'bcrypt';
import { Op } from 'sequelize';

export const userDashboard = async (req, res) => {
  try {
    if (!req.session?.userId) return res.redirect('/login');
    const u = await User.findByPk(req.session.userId);
    if (!u) return res.redirect('/login');

    // Upcoming appointments (future or today)
    const today = new Date();
  const upcomingAll = await Appointment.findAll({ where: { userId: req.session.userId, date: { [Op.gte]: today.toISOString().slice(0,10) } }, order: [['date','ASC'], ['time','ASC']] });
    // Limit to next 5 for display
    const upcoming = upcomingAll.slice(0,5).map(a => ({
      whenReadable: (new Date(a.date)).toLocaleDateString() + (a.time ? (' • ' + a.time) : ''),
      type: a.type || 'Consultation',
      staffName: a.staffName || 'Clinic',
      status: a.status || 'pending'
    }));
    const upcomingCount = upcomingAll.length;
    const nextAppointmentSummary = upcoming.length ? upcoming[0].whenReadable + ' (' + upcoming[0].type + ')' : 'None';

    // Medicines on hold: count handouts for this user
  const medsOnHold = await Handout.count({ where: { userId: req.session.userId } });

    // Recent activity: notifications where user is recipient or target
  const notifs = await Notification.findAll({ where: { [Op.or]: [{ userId: req.session.userId }, { targetUserId: req.session.userId }] }, order: [['createdAt','DESC']], limit: 6 });
    const recentActivity = notifs.map(n => `${n.title}: ${n.message}`);

    const currentUser = { id: u.id, name: u.name, role: u.role };
    res.render('user/dashboard', { title: 'User Dashboard', currentUserName: u.name, currentUser, upcomingCount, nextAppointmentSummary, medicinesOnHold: medsOnHold, upcoming, recentActivity });
  } catch (err) {
    console.error('userDashboard error', err);
    res.status(500).render('home', { error: 'Server error' });
  }
};

export default { userDashboard };

export const userAppointments = async (req, res) => {
  if (!req.session?.userId) return res.redirect('/login');
  try {
    const appts = await Appointment.findAll({ where: { userId: req.session.userId }, order: [['date','DESC']] });
    const u = await User.findByPk(req.session.userId);
    const currentUser = { id: u.id, name: u.name, role: u.role };
    res.render('user/appointments', { title: 'My Appointments', appointments: appts, currentUser });
  } catch (err) {
    console.error('userAppointments error', err);
    res.status(500).render('home', { error: 'Server error' });
  }
};

export const userProfile = async (req, res) => {
  if (!req.session?.userId) return res.redirect('/login');
  if (req.method === 'POST') {
    // update profile
    const { name, email, password } = req.body;
    const u = await User.findByPk(req.session.userId);
    if (!u) return res.redirect('/login');
    u.name = name || u.name;
    u.email = email || u.email;
    if (password && password.length >= 6) {
      // lazy-hash here using bcrypt
      import('bcrypt').then(async (bcrypt) => {
        u.password = await bcrypt.hash(password, 10);
        await u.save();
        res.redirect('/user/profile');
      }).catch(err => {
        console.error('password hash error', err);
        res.redirect('/user/profile');
      });
    } else {
      await u.save();
      res.redirect('/user/profile');
    }
  } else {
    const u = await User.findByPk(req.session.userId);
    const currentUser = { id: u.id, name: u.name, role: u.role, email: u.email };
    res.render('user/profile', { title: 'Profile', currentUser });
  }
};

export const userNewAppointment = async (req, res) => {
  if (!req.session?.userId) return res.redirect('/login');
  try {
    const u = await User.findByPk(req.session.userId);
    if (!u) return res.redirect('/login');
    const currentUser = { id: u.id, name: u.name, role: u.role };
    // Render a simple booking form
    res.render('appointments/new', { title: 'Book Appointment', currentUser, minDate: (new Date()).toISOString().slice(0,10) });
  } catch (err) {
    console.error('userNewAppointment error', err);
    res.status(500).render('home', { error: 'Server error' });
  }
};

export const userCreateAppointment = async (req, res) => {
  if (!req.session?.userId) return res.redirect('/login');
  try {
    const userId = req.session.userId;
    const { date, time, type, notes } = req.body || {};
    if (!date) {
      if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') !== -1)) return res.status(400).json({ error: 'Date is required' });
      req.flash && req.flash('error_msg', 'Date is required');
      return res.redirect('/appointments/new');
    }
    // Basic date validation: cannot book in the past
    const todayStr = (new Date()).toISOString().slice(0,10);
    if (date < todayStr) {
      if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') !== -1)) return res.status(400).json({ error: 'Cannot book a past date' });
      req.flash && req.flash('error_msg', 'Cannot book a past date');
      return res.redirect('/appointments/new');
    }
    const appt = await Appointment.create({ userId, date, time: time || null, type: type || 'Consultation', notes: notes || null, status: 'pending' });

    // create a notification/audit log for admins/staff
    try {
      await Notification.sync();
      const u = await User.findByPk(userId);
      await Notification.create({ actorId: userId, action: 'appointment.create', title: 'New appointment requested', message: `${u?.name || 'User'} requested an appointment on ${date}${time ? ' at ' + time : ''}`, details: { appointmentId: appt.id, date, time, type }, targetUserId: null });
    } catch (e) {
      console.warn('Notification create failed', e);
    }

    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') !== -1)) {
      return res.json({ success: true, appointment: appt });
    }
    req.flash && req.flash('success_msg', 'Appointment requested');
    return res.redirect('/user/appointments');
  } catch (err) {
    console.error('userCreateAppointment error', err);
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') !== -1)) return res.status(500).json({ error: 'Server error' });
    req.flash && req.flash('error_msg', 'Server error');
    return res.redirect('/appointments/new');
  }
};

export const userHandouts = async (req, res) => {
  if (!req.session?.userId) return res.redirect('/login');
  try {
    const userId = req.session.userId;
    const handouts = await Handout.findAll({ where: { userId }, include: [Medicine], order: [['createdAt','DESC']] });
    const u = await User.findByPk(userId);
    const currentUser = { id: u.id, name: u.name, role: u.role };
    res.render('user/handouts', { title: 'My Prescriptions', handouts, currentUser });
  } catch (err) {
    console.error('userHandouts error', err);
    res.status(500).render('home', { error: 'Server error' });
  }
};

export const userNewHandout = async (req, res) => {
  if (!req.session?.userId) return res.redirect('/login');
  try {
    // show medicines that are available
    const meds = await Medicine.findAll({ where: { stock: { [Op.gt]: 0 } }, order: [['name','ASC']] });
    const u = await User.findByPk(req.session.userId);
    const currentUser = { id: u.id, name: u.name, role: u.role };
    res.render('handouts/new', { title: 'Request Medicine', meds, currentUser });
  } catch (err) {
    console.error('userNewHandout error', err);
    res.status(500).render('home', { error: 'Server error' });
  }
};

export const userCreateHandout = async (req, res) => {
  if (!req.session?.userId) return res.redirect('/login');
  try {
    const userId = req.session.userId;
    const { medicineId, quantity, notes } = req.body || {};
    if (!medicineId) {
      req.flash && req.flash('error_msg', 'Please select a medicine');
      // if XHR, return JSON error
      if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') !== -1)) return res.status(400).json({ error: 'Please select a medicine' });
      return res.redirect('/handouts/new');
    }
    const qty = parseInt(quantity, 10) || 1;
    // create a Handout record so the user can see their request immediately
    // Note: actual dispensing / stock adjustment should be performed by staff when processing the request.
    try {
      // mark as requested so staff/admin can process it later
      await Handout.create({ medicineId, userId, quantity: qty, notes: notes || null, status: 'requested' });
    } catch (e) {
      console.warn('Handout create (request) failed', e);
    }

    // create a notification for staff/admin to process this request
    try {
      await Notification.sync();
      const u = await User.findByPk(userId);
      const med = await Medicine.findByPk(medicineId);
      await Notification.create({
        actorId: userId,
        action: 'handout.request',
        title: 'Medicine request',
        message: `${u?.name || 'User'} requested ${qty} x ${med?.name || 'medicine'}`,
        details: { medicineId, quantity: qty, notes },
        targetUserId: null
      });
    } catch (e) {
      console.warn('Notification create failed', e);
    }
  req.flash && req.flash('success_msg', 'Your request has been sent. Staff will process it soon.');
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') !== -1)) {
      return res.json({ success: true, redirect: '/user/handouts', message: 'Your request has been sent. Staff will process it soon.' });
    }
    return res.redirect('/user/handouts');
  } catch (err) {
    console.error('userCreateHandout error', err);
    req.flash && req.flash('error_msg', 'Server error');
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') !== -1)) return res.status(500).json({ error: 'Server error' });
    return res.redirect('/handouts/new');
  }
};

export const userNotifications = async (req, res) => {
  if (!req.session?.userId) return res.redirect('/login');
  try {
    const userId = req.session.userId;
    // fetch notifications where the user is recipient or target
    const notifications = await Notification.findAll({
      where: { [Op.or]: [{ userId }, { targetUserId: userId }] },
      order: [['createdAt','DESC']],
      limit: 200,
      include: [
        { model: User, as: 'actor', attributes: ['id','name'] },
        { model: User, as: 'target', attributes: ['id','name'] }
      ]
    });
    const notifCount = await Notification.count({ where: { userId, read: false } });
    const notificationsSafe = notifications.map(n => {
      const row = n.toJSON ? n.toJSON() : n;
      row.detailsStr = row.details ? (typeof row.details === 'string' ? row.details : JSON.stringify(row.details)) : '';
      return row;
    });
    const u = await User.findByPk(userId);
    const currentUser = { id: u.id, name: u.name, role: u.role };
    res.render('user/notifications', { title: 'Notifications', notifications: notificationsSafe, notifCount, currentUser });
  } catch (err) {
    console.error('userNotifications error', err);
    res.status(500).render('home', { error: 'Server error' });
  }
};

// User settings page (GET)
export const userSettings = async (req, res) => {
  if (!req.session?.userId) return res.redirect('/login');
  try {
    const u = await User.findByPk(req.session.userId);
    if (!u) return res.redirect('/login');
    const currentUser = { id: u.id, name: u.name, role: u.role, email: u.email };
    res.render('user/settings', { title: 'Settings', currentUser });
  } catch (err) {
    console.error('userSettings error', err);
    res.status(500).render('home', { error: 'Server error' });
  }
};

// User change password (POST)
export const userChangePassword = async (req, res) => {
  if (!req.session?.userId) return res.redirect('/login');
  try {
    const { oldPassword, newPassword, newPasswordConfirm } = req.body || {};
    if (!oldPassword || !newPassword || !newPasswordConfirm) {
      req.flash('error_msg', 'All fields are required');
      return res.redirect('/user/settings');
    }
    if (newPassword !== newPasswordConfirm) {
      req.flash('error_msg', 'New passwords do not match');
      return res.redirect('/user/settings');
    }
    const u = await User.findByPk(req.session.userId);
    if (!u) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/user/settings');
    }
    const match = await bcrypt.compare(oldPassword, u.password);
    if (!match) {
      req.flash('error_msg', 'Old password is incorrect');
      return res.redirect('/user/settings');
    }
    const saltRounds = 10;
    const hashed = await bcrypt.hash(newPassword, saltRounds);
    u.password = hashed;
    await u.save();
    try {
      await Notification.sync();
      await Notification.create({ userId: u.id, title: 'Password changed', message: 'Your account password was changed.', read: false });
    } catch (e) { console.warn('Notification create failed', e); }
    req.flash('success_msg', 'Password updated successfully');
    return res.redirect('/user/settings');
  } catch (err) {
    console.error('userChangePassword error', err);
    req.flash('error_msg', 'Server error');
    return res.redirect('/user/settings');
  }
};

// API: return counts for user-specific notification types (appointments confirmed, password changed)
export const userNotificationCounts = async (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ error: 'Unauthenticated' });
  try {
    const userId = req.session.userId;
    // Count appointment-related and password-change notifications addressed to this user
    const apptCount = await Notification.count({ where: { targetUserId: userId, read: false, action: { [Op.in]: ['appointment.confirmed','appointment.updated','appointment.cancelled'] } } });
    const passCount = await Notification.count({ where: { userId: userId, read: false, action: 'user.password.changed' } }).catch(() => 0);
    return res.json({ appointmentNotifications: apptCount || 0, passwordNotifications: passCount || 0, total: (apptCount||0) + (passCount||0) });
  } catch (err) {
    console.error('userNotificationCounts error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

export const userMarkRead = async (req, res) => {
  if (!req.session?.userId) return res.redirect('/login');
  try {
    const id = req.params.id;
    const userId = req.session.userId;
    await Notification.update({ read: true }, { where: { id, [Op.or]: [{ userId }, { targetUserId: userId }] } });
    return res.redirect('/user/notifications');
  } catch (err) {
    console.error('userMarkRead error', err);
    return res.redirect('/user/notifications');
  }
};

export const userDeleteNotification = async (req, res) => {
  if (!req.session?.userId) return res.redirect('/login');
  try {
    const id = req.params.id;
    const userId = req.session.userId;
    await Notification.destroy({ where: { id, [Op.or]: [{ userId }, { targetUserId: userId }] } });
    return res.redirect('/user/notifications');
  } catch (err) {
    console.error('userDeleteNotification error', err);
    return res.redirect('/user/notifications');
  }
};
