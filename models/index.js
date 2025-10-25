import { Medicine } from './medicineModel.js';
import { Handout } from './handoutModel.js';
import User from './userModel.js';
import Appointment from './appointmentModel.js';
import Notification from './notificationModel.js';

// Setup associations centrally
Medicine.hasMany(Handout, { foreignKey: 'medicineId' });
Handout.belongsTo(Medicine, { foreignKey: 'medicineId' });
Handout.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(Handout, { foreignKey: 'userId' });
// Appointments
Appointment.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(Appointment, { foreignKey: 'userId' });
// Notifications
// keep the original recipient relation for backward compatibility
Notification.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(Notification, { foreignKey: 'userId' });
// audit/log relations
Notification.belongsTo(User, { as: 'actor', foreignKey: 'actorId' });
Notification.belongsTo(User, { as: 'target', foreignKey: 'targetUserId' });
User.hasMany(Notification, { as: 'actorLogs', foreignKey: 'actorId' });
User.hasMany(Notification, { as: 'targetLogs', foreignKey: 'targetUserId' });

export { Medicine, Handout, User, Appointment, Notification };
export default { Medicine, Handout, User, Appointment, Notification };
