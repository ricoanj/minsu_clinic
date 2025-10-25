import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";
import { Medicine } from "./medicineModel.js";
import { User } from "./userModel.js";

export const Handout = sequelize.define('Handout', {
  medicineId: { type: DataTypes.INTEGER, allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: true },
  quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  notes: { type: DataTypes.TEXT, allowNull: true }
});
export default Handout;
