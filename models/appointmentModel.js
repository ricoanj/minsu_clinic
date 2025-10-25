import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const Appointment = sequelize.define('Appointment', {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  time: { type: DataTypes.STRING, allowNull: true },
  type: { type: DataTypes.STRING, allowNull: true },
  status: { type: DataTypes.STRING, allowNull: true, defaultValue: 'pending' },
  notes: { type: DataTypes.TEXT, allowNull: true }
});

export default Appointment;
