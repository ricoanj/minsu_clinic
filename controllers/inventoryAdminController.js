import { Medicine, Notification, User } from "../models/index.js";

export const adminListMedicines = async (req, res) => {
  if (req.session?.userRole !== 'admin') return res.status(403).render('home', { error: 'Access denied' });
  const meds = await Medicine.findAll({ order: [['name','ASC']] });
  const isAdmin = true;
  const isStaff = false;
  res.render('inventory/manageMedicines', { title: 'Manage Medicines', meds, isAdmin, isStaff, currentUserRole: req.session?.userRole });
};

// Note: Add/Edit pages are now handled via modals on the manageMedicines page.

export const adminCreateMedicine = async (req, res) => {
  try {
    if (req.session?.userRole !== 'admin') return res.status(403).render('home', { error: 'Access denied' });
    const { name, sku, stock, unit } = req.body;
    if (!name) {
      const meds = await Medicine.findAll({ order: [['name','ASC']] });
      if (req.xhr || req.headers.accept?.includes('application/json')) return res.status(400).json({ success: false, error: 'Name is required' });
      return res.render('inventory/manageMedicines', { error: 'Name is required', meds });
    }
    const parsedStock = parseInt(stock, 10) || 0;
    await Medicine.create({ name, sku: sku || null, stock: parsedStock, unit: unit || null });
  // log creation
    try {
      try { await Notification.sync({ alter: true }); } catch(e){ console.warn('Notification.sync alter failed', e); }
      await Notification.create({
        actorId: req.session?.userId || null,
        action: 'medicine.create',
        title: 'Medicine created',
        message: `${req.session?.userId ? 'User ID ' + req.session.userId : 'System'} created medicine ${name}`
      });
    } catch(e){ console.warn('medicine create log failed', e); }
    if (req.xhr || req.headers.accept?.includes('application/json')) return res.json({ success: true, message: 'Medicine created' });
    res.redirect('/admin/inventory/medicines');
  } catch (err) {
    console.error('adminCreateMedicine error', err);
    const meds = await Medicine.findAll({ order: [['name','ASC']] });
    if (req.xhr || req.headers.accept?.includes('application/json')) return res.status(500).json({ success: false, error: 'Server error' });
    res.render('inventory/manageMedicines', { error: 'Server error', meds });
  }
};

// Edit page is handled via modal on the manage page. POST handler below updates.

export const adminUpdateMedicine = async (req, res) => {
  try {
    if (req.session?.userRole !== 'admin') return res.status(403).render('home', { error: 'Access denied' });
    const med = await Medicine.findByPk(req.params.id);
    if (!med) return res.redirect('/admin/inventory/medicines');
    const { name, sku, stock, unit } = req.body;
    med.name = name || med.name;
    med.sku = sku || med.sku;
    med.stock = parseInt(stock, 10) || 0;
    med.unit = unit || med.unit;
  await med.save();
    // log update
    try {
      try { await Notification.sync({ alter: true }); } catch(e){ console.warn('Notification.sync alter failed', e); }
      await Notification.create({
        actorId: req.session?.userId || null,
        targetUserId: med.id,
        action: 'medicine.update',
        title: 'Medicine updated',
        message: `${req.session?.userId ? 'User ID ' + req.session.userId : 'System'} updated medicine ${med.name}`
      });
    } catch(e){ console.warn('medicine update log failed', e); }
    if (req.xhr || req.headers.accept?.includes('application/json')) return res.json({ success: true, message: 'Medicine updated' });
    res.redirect('/admin/inventory/medicines');
  } catch (err) {
    console.error('adminUpdateMedicine error', err);
    const meds = await Medicine.findAll({ order: [['name','ASC']] });
    if (req.xhr || req.headers.accept?.includes('application/json')) return res.status(500).json({ success: false, error: 'Server error' });
    res.render('inventory/manageMedicines', { error: 'Server error', meds });
  }
};

export const adminDeleteMedicine = async (req, res) => {
  try {
    if (req.session?.userRole !== 'admin') return res.status(403).render('home', { error: 'Access denied' });
    const med = await Medicine.findByPk(req.params.id);
    if (!med) return res.redirect('/admin/inventory/medicines');
  await med.destroy();
    try {
      try { await Notification.sync({ alter: true }); } catch(e){ console.warn('Notification.sync alter failed', e); }
      await Notification.create({
        actorId: req.session?.userId || null,
        targetUserId: med.id,
        action: 'medicine.delete',
        title: 'Medicine deleted',
        message: `${req.session?.userId ? 'User ID ' + req.session.userId : 'System'} deleted medicine ${med.name}`
      });
    } catch(e){ console.warn('medicine delete log failed', e); }
    if (req.xhr || req.headers.accept?.includes('application/json')) return res.json({ success: true, message: 'Medicine deleted' });
    res.redirect('/admin/inventory/medicines');
  } catch (err) {
    console.error('adminDeleteMedicine error', err);
    if (req.xhr || req.headers.accept?.includes('application/json')) return res.status(500).json({ success: false, error: 'Server error' });
    res.redirect('/admin/inventory/medicines');
  }
};

export default {
  adminListMedicines,
  adminCreateMedicine,
  adminUpdateMedicine,
  adminDeleteMedicine
};
