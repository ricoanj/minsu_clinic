import { Medicine, Handout, User, Notification } from "../models/index.js";

export const listMedicines = async (req, res) => {
  // Staff-only inventory listing (admins should use the admin inventory routes)
  if (req.session?.userRole !== 'staff') return res.status(403).render('home', { error: 'Access denied' });
  const meds = await Medicine.findAll({ order: [['name','ASC']] });
  // Render the single medicines/manage view. Staff will see view-only UI; admin gets full actions.
  const isAdmin = false;
  const isStaff = req.session?.userRole === 'staff';
  res.render('inventory/manageMedicines', { title: 'Medicines', meds, isAdmin, isStaff, currentUserRole: req.session?.userRole });
};

export const listHandouts = async (req, res) => {
  // allow both staff and admin to view/process handouts
  if (!['staff','admin'].includes(req.session?.userRole)) return res.status(403).render('home', { error: 'Access denied' });
  const handouts = await Handout.findAll({ include: [Medicine, User], order: [['createdAt','DESC']] });
  const handoutsSafe = handouts.map(h => {
    const row = h && h.toJSON ? h.toJSON() : h;
    row.isRequested = String(row.status || 'requested') === 'requested';
    return row;
  });
  const meds = await Medicine.findAll({ order: [['name','ASC']] });
  const users = await User.findAll({ order: [['name','ASC']] });
  const isStaff = req.session?.userRole === 'staff';
  const isAdmin = req.session?.userRole === 'admin';
  res.render('inventory/handouts', { title: 'Handouts', handouts: handoutsSafe, meds, users, isStaff, isAdmin });
};

// Note: The new handout form is presented as a modal on the Handouts page.

export const createHandout = async (req, res) => {
  try {
    const { medicineId, userId, quantity, notes } = req.body;
  if (!['staff','admin'].includes(req.session?.userRole)) return res.status(403).render('home', { error: 'Access denied' });
    const qty = parseInt(quantity, 10) || 1;
    const med = await Medicine.findByPk(medicineId);
    if (!med) {
      const handouts = await Handout.findAll({ include: [Medicine, User], order: [['createdAt','DESC']] });
      const isStaff = req.session?.userRole === 'staff';
      return res.render('inventory/handouts', { error: 'Medicine not found', handouts, isStaff });
    }
    if (med.stock < qty) {
      const handouts = await Handout.findAll({ include: [Medicine, User], order: [['createdAt','DESC']] });
      const isStaff = req.session?.userRole === 'staff';
      return res.render('inventory/handouts', { error: 'Insufficient stock', handouts, isStaff });
    }

    // create handout and decrement stock in a transaction
    const { sequelize } = Medicine;
    await sequelize.transaction(async (t) => {
      // when staff/admin creates a handout it is considered processed/issued immediately
      await Handout.create({ medicineId, userId: userId || null, quantity: qty, notes, status: 'processed', processedBy: req.session?.userId || null, processedAt: new Date() }, { transaction: t });
      med.stock = med.stock - qty;
      await med.save({ transaction: t });
    });
    // log handout
    try {
      try { await Notification.sync({ alter: true }); } catch(e){ console.warn('Notification.sync alter failed', e); }
      await Notification.create({
        actorId: req.session?.userId || null,
        targetUserId: userId || null,
        action: 'handout.create',
        title: 'Handout created',
        message: `${req.session?.userId ? 'User ID ' + req.session.userId : 'System'} created handout for medicine ${med.name}`
      });
    } catch(e){ console.warn('handout log failed', e); }
  res.redirect('/inventory/handouts');
  } catch (err) {
    console.error('createHandout error', err);
    const handouts = await Handout.findAll({ include: [Medicine, User], order: [['createdAt','DESC']] });
    const isStaff = req.session?.userRole === 'staff';
    res.render('inventory/handouts', { error: 'Server error', handouts, isStaff });
  }
};

// Process an existing handout request (staff/admin)
export const processHandout = async (req, res) => {
  if (!['staff','admin'].includes(req.session?.userRole)) return res.status(403).render('home', { error: 'Access denied' });
  try {
    const id = req.params.id;
    const handout = await Handout.findByPk(id);
    if (!handout) return res.redirect('/inventory/handouts');
    if (handout.status && handout.status !== 'requested') {
      // already processed
      return res.redirect('/inventory/handouts');
    }
    const med = await Medicine.findByPk(handout.medicineId);
    if (!med || med.stock < handout.quantity) {
      req.flash && req.flash('error_msg', 'Insufficient stock to process this request');
      return res.redirect('/inventory/handouts');
    }
    const { sequelize } = Medicine;
    await sequelize.transaction(async (t) => {
      // decrement stock and mark handout processed
      med.stock = med.stock - handout.quantity;
      await med.save({ transaction: t });
      handout.status = 'processed';
      handout.processedBy = req.session?.userId || null;
      handout.processedAt = new Date();
      await handout.save({ transaction: t });
    });
    try {
      await Notification.create({ actorId: req.session?.userId || null, targetUserId: handout.userId || null, action: 'handout.processed', title: 'Medicine ready', message: `Your request for medicine has been processed.`, details: { handoutId: handout.id } });
    } catch(e){ console.warn('notify failed', e); }
    return res.redirect('/inventory/handouts');
  } catch (err) {
    console.error('processHandout error', err);
    return res.redirect('/inventory/handouts');
  }
};

export default { listMedicines, listHandouts, createHandout, processHandout };
