import { User, Medicine, Handout, Appointment, Notification } from "../models/index.js";
import { Op } from 'sequelize';
import bcrypt from 'bcrypt';

export const adminDashboard = async (req, res) => {
  try {
    const role = req.session?.userRole;
    if (role !== 'admin') return res.status(403).render('home', { error: 'Access denied' });

    let user = null;
    if (req.session?.userId) {
      const u = await User.findByPk(req.session.userId);
      if (u) user = { id: u.id, name: u.name, role: u.role, email: u.email, avatarUrl: u.avatarUrl };
    }

    // Render admin dashboard
    const userCount = await User.count();
    const medCount = await Medicine.count();
    const handoutCount = await Handout.count();
    const apptCount = await Appointment.count();
    // compute unread notifications for this user
    const notifCount = user ? await Notification.count({ where: { userId: user.id, read: false } }) : 0;
    res.render('admin/dashboard', { title: 'Admin Dashboard', user, stats: { userCount, medCount, handoutCount, apptCount }, notifCount, notifications: [] });
  } catch (err) {
    console.error('adminDashboard error', err);
    res.status(500).render('home', { error: 'Server error' });
  }
};

export default { adminDashboard };

export const adminUsers = async (req, res) => {
  if (req.session?.userRole !== 'admin') return res.status(403).render('home', { error: 'Access denied' });
  let user = null;
  if (req.session?.userId) {
    const u = await User.findByPk(req.session.userId);
    if (u) user = { id: u.id, name: u.name, role: u.role, email: u.email, avatarUrl: u.avatarUrl };
  }
  const users = await User.findAll({ order: [['name','ASC']] });
  const notifCount = user ? await Notification.count({ where: { userId: user.id, read: false } }) : 0;
  res.render('admin/users', { title: 'Manage Users', user, users, notifCount, notifications: [] });
};

export const adminSettings = async (req, res) => {
  if (req.session?.userRole !== 'admin') return res.status(403).render('home', { error: 'Access denied' });
  let user = null;
  if (req.session?.userId) {
    const u = await User.findByPk(req.session.userId);
    if (u) user = { id: u.id, name: u.name, role: u.role, email: u.email, avatarUrl: u.avatarUrl };
  }
  // pass settings placeholder if you have a settings store
  const notifCount = user ? await Notification.count({ where: { userId: user.id, read: false } }) : 0;
  // Render without a layout to avoid template engine layout resolution issues in some environments
  res.render('admin/settings', { title: 'Site Settings', user, settings: {} , notifCount, notifications: [], layout: false });
};

export const adminReports = async (req, res) => {
  if (req.session?.userRole !== 'admin') return res.status(403).render('home', { error: 'Access denied' });
  let user = null;
  if (req.session?.userId) {
    const u = await User.findByPk(req.session.userId);
    if (u) user = { id: u.id, name: u.name, role: u.role, email: u.email, avatarUrl: u.avatarUrl };
  }
  try {
    // basic counts
    const [userCount, medCount, handoutCount, apptCount] = await Promise.all([
      User.count(),
      Medicine.count(),
      Handout.count(),
      Appointment.count()
    ]);

    // low stock threshold
    const lowStockCount = await Medicine.count({ where: { stock: { [Op.lte]: 5 } } });

    // appointments by status (common statuses)
    const pendingCount = await Appointment.count({ where: { status: 'pending' } });
    const completedCount = await Appointment.count({ where: { status: 'completed' } });
    const cancelledCount = await Appointment.count({ where: { status: 'cancelled' } });

    // recent records
    const recentUsers = await User.findAll({ order: [['createdAt', 'DESC']], limit: 6, attributes: ['id','name','email','role','createdAt'] });
    const recentAppointments = await Appointment.findAll({ include: [{ model: User, attributes: ['id','name','email'] }], order: [['date','DESC'], ['time','DESC']], limit: 8 });

    const notifCount = user ? await Notification.count({ where: { userId: user.id, read: false } }) : 0;

    const stats = { userCount, medCount, handoutCount, apptCount, lowStockCount, pendingCount, completedCount, cancelledCount };

    res.render('admin/reports', { title: 'Reports', user, stats, recentUsers, recentAppointments, notifCount, notifications: [] });
  } catch (err) {
    console.error('adminReports error', err);
    res.status(500).render('home', { error: 'Server error' });
  }
};

// Profile page
export const adminProfile = async (req, res) => {
  if (req.session?.userRole !== 'admin') return res.status(403).render('home', { error: 'Access denied' });
  let user = null;
  if (req.session?.userId) {
    const u = await User.findByPk(req.session.userId);
    if (u) user = { id: u.id, name: u.name, role: u.role, email: u.email, avatarUrl: u.avatarUrl };
  }
  const notifCount = user ? await Notification.count({ where: { userId: user.id, read: false } }) : 0;
  res.render('admin/profile', { title: 'Profile', user, notifCount, notifications: [] });
};

// Notifications list
export const adminNotifications = async (req, res) => {
  if (req.session?.userRole !== 'admin') return res.status(403).render('home', { error: 'Access denied' });
  let user = null;
  if (req.session?.userId) {
    const u = await User.findByPk(req.session.userId);
    if (u) user = { id: u.id, name: u.name, role: u.role, email: u.email, avatarUrl: u.avatarUrl };
  }
  // Ensure Notification table has audit columns (actorId/targetUserId) - run an alter sync in dev
  try {
    await Notification.sync({ alter: true });
  } catch (e) {
    console.warn('Notification.sync alter failed', e);
  }
  // For audit logs: fetch recent logs including actor and target information
  const notifications = await Notification.findAll({ order: [['createdAt', 'DESC']], include: [
    { model: User, as: 'actor', attributes: ['id','name'] },
    { model: User, as: 'target', attributes: ['id','name'] }
  ], limit: 200 });
  // still compute a per-user unread count for personal notifications (targeted)
  const notifCount = user ? await Notification.count({ where: { targetUserId: user.id, read: false } }) : 0;
  // stringify details for template-friendly display
  const notificationsSafe = notifications.map(n => {
    const row = n.toJSON ? n.toJSON() : n;
    row.detailsStr = row.details ? JSON.stringify(row.details) : '';
    return row;
  });
  res.render('admin/notifications', { title: 'Logs', user, notifications: notificationsSafe, notifCount });
};

// POST: mark notification read (placeholder)
export const adminMarkRead = async (req, res) => {
  if (req.session?.userRole !== 'admin') return res.status(403).render('home', { error: 'Access denied' });
  // In a real implementation you'd update a Notification model here.
  const id = req.params.id;
  // For now, redirect back to list
  try {
    await Notification.update({ read: true }, { where: { id, userId: req.session.userId } });
  } catch (e) { console.warn('markRead error', e); }
  res.redirect('/admin/notifications');
};

// POST: delete notification (placeholder)
export const adminDeleteNotification = async (req, res) => {
  if (req.session?.userRole !== 'admin') return res.status(403).render('home', { error: 'Access denied' });
  const id = req.params.id;
  // Real delete would remove from DB. For now, redirect.
  try {
    await Notification.destroy({ where: { id, userId: req.session.userId } });
  } catch (e) { console.warn('deleteNotif error', e); }
  res.redirect('/admin/notifications');
};

// Change password (GET)
export const adminChangePasswordPage = async (req, res) => {
  if (req.session?.userRole !== 'admin') return res.status(403).render('home', { error: 'Access denied' });
  let user = null;
  if (req.session?.userId) {
    const u = await User.findByPk(req.session.userId);
    if (u) user = { id: u.id, name: u.name, role: u.role, email: u.email, avatarUrl: u.avatarUrl };
  }
  res.render('admin/change-password', { title: 'Change Password', user });
};

// Change password (POST)
export const adminChangePassword = async (req, res) => {
  try {
    if (req.session?.userRole !== 'admin') return res.status(403).render('home', { error: 'Access denied' });
    const { oldPassword, newPassword, newPasswordConfirm } = req.body || {};
    if (!oldPassword || !newPassword || !newPasswordConfirm) {
      req.flash('error_msg', 'All fields are required');
      return res.redirect('/admin/change-password');
    }
    if (newPassword !== newPasswordConfirm) {
      req.flash('error_msg', 'New passwords do not match');
      return res.redirect('/admin/change-password');
    }
    const u = await User.findByPk(req.session.userId);
    if (!u) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/admin/change-password');
    }
    const match = await bcrypt.compare(oldPassword, u.password);
    if (!match) {
      req.flash('error_msg', 'Old password is incorrect');
      return res.redirect('/admin/change-password');
    }
    const saltRounds = 10;
    const hashed = await bcrypt.hash(newPassword, saltRounds);
    u.password = hashed;
    await u.save();
    // create an in-app notification for the user
    try {
      await Notification.sync();
      await Notification.create({ userId: u.id, title: 'Password changed', message: 'Your account password was changed.', read: false });
    } catch (e) {
      console.warn('Notification create failed', e);
    }
    req.flash('success_msg', 'Password updated successfully');
    return res.redirect('/admin/profile');
  } catch (err) {
    console.error('adminChangePassword error', err);
    req.flash('error_msg', 'Server error');
    return res.redirect('/admin/change-password');
  }
};

// POST: update user (role only from edit modal)
export const adminUpdateUser = async (req, res) => {
  try {
    if (req.session?.userRole !== 'admin') return res.status(403).render('home', { error: 'Access denied' });
    const id = req.params.id;
    const { role } = req.body || {};
    const allowed = ['admin','staff','user'];
    if (!role || !allowed.includes(role)) {
      req.flash('error_msg', 'Invalid role');
      return res.redirect('/admin/users');
    }
    const u = await User.findByPk(id);
    if (!u) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/admin/users');
    }
    const oldRole = u.role;
    u.role = role;
    await u.save();
    // Create an audit log entry
    try {
      const actor = req.session?.userId ? await User.findByPk(req.session.userId) : null;
      try { await Notification.sync({ alter: true }); } catch(e){ console.warn('Notification.sync alter failed', e); }
      await Notification.create({
        actorId: actor?.id || null,
        targetUserId: u.id,
        action: 'user.update.role',
        title: 'User role updated',
        message: `${actor?.name || 'System'} changed role for ${u.name} from ${oldRole} to ${u.role}`,
        details: { oldRole, newRole: u.role }
      });
    } catch (e) {
      console.warn('Failed to create audit log for user role update', e);
    }
    req.flash('success_msg', 'User role updated');
    return res.redirect('/admin/users');
  } catch (err) {
    console.error('adminUpdateUser error', err);
    req.flash('error_msg', 'Server error');
    return res.redirect('/admin/users');
  }
};

// POST: delete user (from delete modal)
export const adminDeleteUser = async (req, res) => {
  try {
    if (req.session?.userRole !== 'admin') return res.status(403).render('home', { error: 'Access denied' });
    const id = req.params.id;
    // prevent deleting self
    if (req.session?.userId && String(req.session.userId) === String(id)) {
      req.flash('error_msg', 'You cannot delete the currently logged in user');
      return res.redirect('/admin/users');
    }
    const u = await User.findByPk(id);
    if (!u) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/admin/users');
    }
    const deletedName = u.name;
    await u.destroy();
    // audit log
    try {
      const actor = req.session?.userId ? await User.findByPk(req.session.userId) : null;
      try { await Notification.sync({ alter: true }); } catch(e){ console.warn('Notification.sync alter failed', e); }
      await Notification.create({
        actorId: actor?.id || null,
        targetUserId: id,
        action: 'user.delete',
        title: 'User deleted',
        message: `${actor?.name || 'System'} deleted user ${deletedName}`
      });
    } catch (e) {
      console.warn('Failed to create audit log for user delete', e);
    }
    req.flash('success_msg', 'User deleted');
    return res.redirect('/admin/users');
  } catch (err) {
    console.error('adminDeleteUser error', err);
    req.flash('error_msg', 'Server error');
    return res.redirect('/admin/users');
  }
};
