
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
    
import bcrypt from "bcrypt";
import { User, Notification } from "../models/index.js";
import { sequelize } from "../models/db.js";
await sequelize.sync();

export const loginPage = (req, res) => res.render("login", { title: "Login" });
export const registerPage = (req, res) => {
  // Allow admin users to see the role selector on the registration page.
  // Also allow a quick dev/testing override with ?showRole=1
  const showRole = (req.session && req.session.userRole === 'admin') || req.query.showRole === '1';
  res.render('register', { title: 'Register', showRole });
};
export const forgotPasswordPage = (req, res) => res.render("forgotpassword", { title: "Forgot Password" });
export const dashboardPage = (req, res) => {
  if (!req.session || !req.session.userId) return res.redirect('/login');
  const role = req.session.userRole || 'user';
  if (role === 'admin') return res.redirect('/admin/dashboard');
  if (role === 'staff') return res.redirect('/staff/dashboard');
  return res.redirect('/user/dashboard');
};

export const loginUser = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ where: { email } });
  if (!user) return res.render('login', { error: 'User not found' });
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.render('login', { error: 'Incorrect password' });
  req.session.userId = user.id;
  // store user role in session for access control
  req.session.userRole = user.role;
  // redirect to role-specific dashboard
  if (user.role === 'admin') return res.redirect('/admin/dashboard');
  if (user.role === 'staff') return res.redirect('/staff/dashboard');
  return res.redirect('/user/dashboard');
};

export const registerUser = async (req, res) => {
  const { name, email, password, passwordConfirm, role } = req.body;

  // basic validation
  if (!name || !email || !password || !passwordConfirm) {
    return res.render('register', { error: 'All fields are required.' });
  }
  if (password !== passwordConfirm) {
    return res.render('register', { error: 'Passwords do not match.' });
  }

  // check if email already exists
  const existing = await User.findOne({ where: { email } });
  if (existing) {
    return res.render('register', { error: 'Email already registered. Please login.' });
  }

  const hashed = await bcrypt.hash(password, 10);
  // Only accept provided role if it's one of the allowed values; otherwise default to 'user'
  const allowed = ['admin', 'staff', 'user'];
  const safeRole = allowed.includes(role) ? role : 'user';
  const user = await User.create({ name, email, password: hashed, role: safeRole });
  req.session.userId = user.id;
  req.session.userRole = user.role;
  // create audit log for registration
  try {
    try { await Notification.sync({ alter: true }); } catch(e){ console.warn('Notification.sync alter failed', e); }
    await Notification.create({
      actorId: req.session?.userRole === 'admin' ? req.session.userId : null,
      targetUserId: user.id,
      action: 'user.create',
      title: 'User registered',
      message: `User ${user.name} (${user.email}) was created`,
    });
  } catch (e) { console.warn('registerUser log create failed', e); }
  // redirect to role-specific dashboard
  if (user.role === 'admin') return res.redirect('/admin/dashboard');
  if (user.role === 'staff') return res.redirect('/staff/dashboard');
  return res.redirect('/user/dashboard');
};

export const logoutUser = (req, res) => {
  req.session.destroy();
  res.redirect("/login");
};
