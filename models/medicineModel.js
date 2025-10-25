import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const Medicine = sequelize.define('Medicine', {
  name: { type: DataTypes.STRING, allowNull: false },
  sku: { type: DataTypes.STRING, allowNull: true },
  stock: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  unit: { type: DataTypes.STRING, allowNull: true }
});

export default Medicine;

