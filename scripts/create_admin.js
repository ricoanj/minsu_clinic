/*
Interactive helper to create an admin/staff/user account.
Usage: node scripts/create_admin.js
*/


//mbcclinic@minsu.edu.ph
//minsuclinic

import inquirer from 'inquirer';
import bcrypt from 'bcrypt';
import { sequelize } from '../models/db.js';
import { User } from '../models/userModel.js';

await sequelize.authenticate();
await sequelize.sync();

const answers = await inquirer.prompt([
  { name: 'name', message: 'Full name:', type: 'input' },
  { name: 'email', message: 'Email:', type: 'input' },
  { name: 'password', message: 'Password:', type: 'password' },
  { name: 'role', message: 'Role:', type: 'list', choices: ['admin', 'staff', 'user'], default: 'admin' }
]);

const hashed = await bcrypt.hash(answers.password, 10);

const [user, created] = await User.findOrCreate({
  where: { email: answers.email },
  defaults: { name: answers.name, password: hashed, role: answers.role }
});

if (!created) {
  console.log('User already exists. Updating role/password...');
  user.name = answers.name;
  user.password = hashed;
  user.role = answers.role;
  await user.save();
}

console.log(`✅ User ${answers.email} (${answers.role}) created/updated.`);
process.exit();
