/*
    MIT License
    
    Copyright (c) 2025 Christian I. Cabrera || XianFire Framework
    Mindoro State University - Philippines

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
    */
    
import express from "express";
import { homePage } from "../controllers/homeController.js";
const router = express.Router();
router.get("/", homePage);

import { loginPage, registerPage, forgotPasswordPage, dashboardPage, loginUser, registerUser, logoutUser } from "../controllers/authController.js";
import { adminDashboard, adminUsers, adminSettings, adminReports } from "../controllers/adminController.js";
import { adminProfile, adminNotifications, adminMarkRead, adminDeleteNotification, adminChangePasswordPage, adminChangePassword } from "../controllers/adminController.js";
import { staffDashboard, staffPatients, staffAppointments, staffNotes, staffSettings, staffNotifications, staffNotificationCounts, staffConfirmAppointment, staffCancelAppointment } from "../controllers/staffController.js";
import { userDashboard, userAppointments, userProfile, userNewAppointment, userCreateAppointment, userHandouts, userNewHandout, userCreateHandout, userNotifications, userMarkRead, userDeleteNotification, userNotificationCounts, userSettings, userChangePassword } from "../controllers/userController.js";
import inventoryController from "../controllers/inventoryController.js";
import inventoryAdminController from "../controllers/inventoryAdminController.js";

router.get("/login", loginPage);
router.post("/login", loginUser);
router.get("/register", registerPage);
router.post("/register", registerUser);
router.get("/forgot-password", forgotPasswordPage);
router.get("/dashboard", dashboardPage);
router.get("/logout", logoutUser);

// Role-specific dashboards
router.get('/admin/dashboard', adminDashboard);
router.get('/admin/users', adminUsers);
router.get('/admin/settings', adminSettings);
router.get('/admin/reports', adminReports);
router.post('/admin/users/:id/edit', (req, res, next) => { if (req.session?.userRole !== 'admin') return res.status(403).render('home', { error: 'Access denied' }); next(); }, async (req, res, next) => { try { const { adminUpdateUser } = await import('../controllers/adminController.js'); return adminUpdateUser(req,res); } catch(e){ next(e); } });
router.post('/admin/users/:id/delete', (req, res, next) => { if (req.session?.userRole !== 'admin') return res.status(403).render('home', { error: 'Access denied' }); next(); }, async (req, res, next) => { try { const { adminDeleteUser } = await import('../controllers/adminController.js'); return adminDeleteUser(req,res); } catch(e){ next(e); } });
router.get('/admin/profile', (req, res, next) => { if (req.session?.userRole !== 'admin') return res.status(403).render('home', { error: 'Access denied' }); next(); }, adminProfile);
router.get('/admin/notifications', (req, res, next) => { if (req.session?.userRole !== 'admin') return res.status(403).render('home', { error: 'Access denied' }); next(); }, adminNotifications);
router.post('/admin/notifications/:id/mark-read', (req, res, next) => { if (req.session?.userRole !== 'admin') return res.status(403).render('home', { error: 'Access denied' }); next(); }, adminMarkRead);
router.post('/admin/notifications/:id/delete', (req, res, next) => { if (req.session?.userRole !== 'admin') return res.status(403).render('home', { error: 'Access denied' }); next(); }, adminDeleteNotification);
// change password
router.get('/admin/change-password', (req, res, next) => { if (req.session?.userRole !== 'admin') return res.status(403).render('home', { error: 'Access denied' }); next(); }, adminChangePasswordPage);
router.post('/admin/change-password', (req, res, next) => { if (req.session?.userRole !== 'admin') return res.status(403).render('home', { error: 'Access denied' }); next(); }, adminChangePassword);
router.get('/staff/dashboard', staffDashboard);
router.get('/staff/patients', staffPatients);
router.get('/staff/appointments', staffAppointments);
// admin-friendly appointments page (reuse staffAppointments handler)
router.get('/admin/appointments', (req, res, next) => { if (req.session?.userRole !== 'admin') return res.status(403).render('home', { error: 'Access denied' }); next(); }, staffAppointments);
router.get('/staff/settings', staffSettings);
router.get('/staff/notes', staffNotes);
router.get('/staff/notifications', (req, res, next) => { if (!['admin','staff'].includes(req.session?.userRole)) return res.status(403).render('home', { error: 'Access denied' }); next(); }, staffNotifications);
// api
router.get('/api/staff/notification-counts', (req, res, next) => { if (!['admin','staff'].includes(req.session?.userRole)) return res.status(403).json({ error: 'Access denied' }); next(); }, staffNotificationCounts);
// appointment actions
router.post('/staff/appointments/:id/confirm', (req, res, next) => { if (!['admin','staff'].includes(req.session?.userRole)) return res.status(403).render('home', { error: 'Access denied' }); next(); }, staffConfirmAppointment);
router.post('/staff/appointments/:id/cancel', (req, res, next) => { if (!['admin','staff'].includes(req.session?.userRole)) return res.status(403).render('home', { error: 'Access denied' }); next(); }, staffCancelAppointment);
router.get('/user/dashboard', userDashboard);
router.get('/user/appointments', userAppointments);
router.get('/user/profile', userProfile);
router.post('/user/profile', (req, res, next) => { if (!req.session?.userId) return res.redirect('/login'); next(); }, userProfile);

// User settings (change password)
router.get('/user/settings', (req, res, next) => { if (!req.session?.userId) return res.redirect('/login'); next(); }, userSettings);
router.post('/user/settings/password', (req, res, next) => { if (!req.session?.userId) return res.redirect('/login'); next(); }, userChangePassword);

// User notifications
router.get('/user/notifications', (req, res, next) => { if (!req.session?.userId) return res.redirect('/login'); next(); }, userNotifications);
router.post('/user/notifications/:id/mark-read', (req, res, next) => { if (!req.session?.userId) return res.redirect('/login'); next(); }, userMarkRead);
router.post('/user/notifications/:id/delete', (req, res, next) => { if (!req.session?.userId) return res.redirect('/login'); next(); }, userDeleteNotification);

// minimal API for user notification counts (used by client-side badge)
router.get('/api/user/notification-counts', (req, res, next) => { if (!req.session?.userId) return res.status(401).json({ error: 'Unauthenticated' }); next(); }, userNotificationCounts);

// Appointment booking (user-facing)
// Generic appointments entrypoint: redirect based on role so /appointments works
router.get('/appointments', (req, res, next) => {
  // Not logged in → go to login
  if (!req.session?.userId) return res.redirect('/login');
  const role = req.session?.userRole;
  if (role === 'admin') return res.redirect('/admin/appointments');
  if (role === 'staff') return res.redirect('/staff/appointments');
  return res.redirect('/user/appointments');
});

router.get('/appointments/new', (req, res, next) => { if (!req.session?.userId) return res.redirect('/login'); next(); }, userNewAppointment);
router.post('/appointments/new', (req, res, next) => { if (!req.session?.userId) return res.redirect('/login'); next(); }, userCreateAppointment);

// User handouts / prescriptions
router.get('/user/handouts', (req, res, next) => { if (!req.session?.userId) return res.redirect('/login'); next(); }, userHandouts);
router.get('/handouts/new', (req, res, next) => { if (!req.session?.userId) return res.redirect('/login'); next(); }, userNewHandout);
router.post('/handouts/new', (req, res, next) => { if (!req.session?.userId) return res.redirect('/login'); next(); }, userCreateHandout);

// Contact page
router.get('/contact', (req, res) => res.render('contact'));

// Inventory
router.get('/inventory/medicines', inventoryController.listMedicines);
router.get('/inventory/handouts', inventoryController.listHandouts);
router.post('/inventory/new', inventoryController.createHandout);
// process an existing handout request (staff/admin)
router.post('/inventory/handouts/:id/process', (req, res, next) => { if (!['admin','staff'].includes(req.session?.userRole)) return res.status(403).render('home', { error: 'Access denied' }); next(); }, inventoryController.processHandout);

// Admin medicines CRUD
router.get('/admin/inventory/medicines', (req, res, next) => {
  if (req.session?.userRole !== 'admin') return res.status(403).render('home', { error: 'Access denied' });
  next();
}, inventoryAdminController.adminListMedicines);
router.post('/admin/inventory/medicines/new', inventoryAdminController.adminCreateMedicine);
// Note: Edit/new pages are handled via modals on the manage page
router.post('/admin/inventory/medicines/:id/edit', inventoryAdminController.adminUpdateMedicine);
router.post('/admin/inventory/medicines/:id/delete', inventoryAdminController.adminDeleteMedicine);

export default router;
