import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

// Notification model now acts as an audit/log record as well as a personal notification.
// Fields:
// - userId: optional recipient (keeps backward compatibility)
// - actorId: who performed the action (admin user id)
// - targetUserId: the user affected by the action
// - action: short action key (eg. 'user.create', 'user.update', 'user.delete')
// - title/message: human-friendly text
// - details: optional JSON/text payload
export const Notification = sequelize.define("Notification", {
  userId: { type: DataTypes.INTEGER, allowNull: true },
  actorId: { type: DataTypes.INTEGER, allowNull: true },
  targetUserId: { type: DataTypes.INTEGER, allowNull: true },
  action: { type: DataTypes.STRING, allowNull: true },
  title: { type: DataTypes.STRING, allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  details: { type: DataTypes.JSON, allowNull: true },
  read: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
});

export default Notification;
