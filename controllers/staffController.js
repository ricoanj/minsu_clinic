import { User, Appointment, Handout, Notification } from "../models/index.js";
import { Op } from 'sequelize';

export const staffDashboard = async (req, res) => {
  try {
    const role = req.session?.userRole;
    if (!['admin', 'staff'].includes(role)) return res.status(403).render('home', { error: 'Access denied' });

    let currentUser = null;
    if (req.session?.userId) {
      const u = await User.findByPk(req.session.userId);
      if (u) currentUser = { id: u.id, name: u.name, role: u.role };
    }

    const patientCount = await User.count({ where: { role: 'user' } });
    const apptCount = await Appointment.count();
    res.render('staff/dashboard', { title: 'Staff Dashboard', currentUser, stats: { patientCount, apptCount } });
  } catch (err) {
    console.error('staffDashboard error', err);
    res.status(500).render('home', { error: 'Server error' });
  }
};

export default { staffDashboard };

export const staffPatients = async (req, res) => {
  if (!['admin','staff'].includes(req.session?.userRole)) return res.status(403).render('home', { error: 'Access denied' });
  const patients = await User.findAll({ where: { role: 'user' }, order: [['name','ASC']] });
  let currentUser = null;
  if (req.session?.userId) {
    const u = await User.findByPk(req.session.userId);
    if (u) currentUser = { id: u.id, name: u.name, role: u.role };
  }
  res.render('staff/patients', { title: 'Patients', patients, currentUser });
};

export const staffAppointments = async (req, res) => {
  if (!['admin','staff'].includes(req.session?.userRole)) return res.status(403).render('home', { error: 'Access denied' });
  const appts = await Appointment.findAll({ include: [User], order: [['date','DESC']] });
  // convert to plain objects and add helper flags to avoid template helpers
  const apptsSafe = appts.map(a => {
    const r = a && a.toJSON ? a.toJSON() : a;
    r.isPending = String(r.status) === 'pending';
    return r;
  });
  let currentUser = null;
  if (req.session?.userId) {
    const u = await User.findByPk(req.session.userId);
    if (u) currentUser = { id: u.id, name: u.name, role: u.role };
  }
  res.render('staff/appointments', { title: 'Appointments', appts: apptsSafe, currentUser });
};

export const staffNotes = async (req, res) => {
  if (!['admin','staff'].includes(req.session?.userRole)) return res.status(403).render('home', { error: 'Access denied' });
  const notes = await Handout.findAll({ include: [User], where: { notes: { [Op.ne]: null } }, order: [['createdAt','DESC']] }).catch(()=>[]);
  let currentUser = null;
  if (req.session?.userId) {
    const u = await User.findByPk(req.session.userId);
    if (u) currentUser = { id: u.id, name: u.name, role: u.role };
  }
  res.render('staff/notes', { title: 'Notes', notes, currentUser });
};

export const staffSettings = async (req, res) => {
  try {
    if (!['admin','staff'].includes(req.session?.userRole)) return res.status(403).render('home', { error: 'Access denied' });
    let currentUser = null;
    if (req.session?.userId) {
      const u = await User.findByPk(req.session.userId);
      if (u) currentUser = { id: u.id, name: u.name, role: u.role };
    }
    res.render('staff/settings', { title: 'Settings', currentUser });
  } catch (err) {
    console.error('staffSettings error', err);
    res.status(500).render('home', { error: 'Server error' });
  }
};

export const staffNotifications = async (req, res) => {
  if (!['admin','staff'].includes(req.session?.userRole)) return res.status(403).render('home', { error: 'Access denied' });
  try {
    const currentUser = req.session?.userId ? await User.findByPk(req.session.userId) : null;
    // Staff should see requests and appointment-related logs
    const notifications = await Notification.findAll({ where: { action: { [Op.in]: ['handout.request','appointment.request','appointment.confirmed','appointment.cancelled'] } }, order: [['createdAt','DESC']], limit: 500, include: [ { model: User, as: 'actor', attributes: ['id','name'] }, { model: User, as: 'target', attributes: ['id','name'] } ] });
    const notifSafe = notifications.map(n => {
      const r = n.toJSON ? n.toJSON() : n;
      r.detailsStr = r.details ? JSON.stringify(r.details) : '';
      // add convenient boolean flags for templates (avoid needing helpers)
      r.isHandoutRequest = r.action === 'handout.request';
      r.isAppointmentRequest = r.action === 'appointment.request';
      return r;
    });
    res.render('staff/notifications', { title: 'Notifications', notifications: notifSafe, currentUser });
  } catch (err) {
    console.error('staffNotifications error', err);
    res.status(500).render('home', { error: 'Server error' });
  }
};

export const staffNotificationCounts = async (req, res) => {
  if (!['admin','staff'].includes(req.session?.userRole)) return res.status(403).json({ error: 'Access denied' });
  try {
    // Count handout requests and appointment requests
    const handoutReq = await Notification.count({ where: { action: 'handout.request', read: false } });
    const apptReq = await Notification.count({ where: { action: 'appointment.request', read: false } });
    return res.json({ handoutRequests: handoutReq || 0, appointmentRequests: apptReq || 0, total: (handoutReq||0) + (apptReq||0) });
  } catch (err) {
    console.error('staffNotificationCounts error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

export const staffConfirmAppointment = async (req, res) => {
  if (!['admin','staff'].includes(req.session?.userRole)) return res.status(403).render('home', { error: 'Access denied' });
  try {
    const id = req.params.id;
    const appt = await Appointment.findByPk(id);
    if (!appt) return res.redirect('/staff/appointments');
    appt.status = 'confirmed';
    await appt.save();
    // notify user
    try { await Notification.create({ actorId: req.session.userId || null, targetUserId: appt.userId || null, action: 'appointment.confirmed', title: 'Appointment confirmed', message: `Your appointment on ${appt.date}${appt.time ? ' at '+appt.time : ''} has been confirmed.`, details: { appointmentId: appt.id } }); } catch(e){ console.warn('notify error', e); }
    return res.redirect('/staff/appointments');
  } catch (err) {
    console.error('staffConfirmAppointment error', err);
    return res.redirect('/staff/appointments');
  }
};

export const staffCancelAppointment = async (req, res) => {
  if (!['admin','staff'].includes(req.session?.userRole)) return res.status(403).render('home', { error: 'Access denied' });
  try {
    const id = req.params.id;
    const appt = await Appointment.findByPk(id);
    if (!appt) return res.redirect('/staff/appointments');
    appt.status = 'cancelled';
    await appt.save();
    try { await Notification.create({ actorId: req.session.userId || null, targetUserId: appt.userId || null, action: 'appointment.cancelled', title: 'Appointment cancelled', message: `Your appointment on ${appt.date}${appt.time ? ' at '+appt.time : ''} was cancelled.`, details: { appointmentId: appt.id } }); } catch(e){ console.warn('notify error', e); }
    return res.redirect('/staff/appointments');
  } catch (err) {
    console.error('staffCancelAppointment error', err);
    return res.redirect('/staff/appointments');
  }
};
