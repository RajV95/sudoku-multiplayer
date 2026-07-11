import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUserStats {
  gamesPlayed: number;
  gamesWon: number;
  bestTimes: {
    easy: number | null;
    medium: number | null;
    hard: number | null;
    expert: number | null;
  };
}

export interface IUser extends Document {
  username: string;
  passwordHash: string;
  stats: IUserStats;
  createdAt: Date;
}

const UserSchema: Schema<IUser> = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    stats: {
      gamesPlayed: { type: Number, default: 0 },
      gamesWon: { type: Number, default: 0 },
      bestTimes: {
        easy: { type: Number, default: null },
        medium: { type: Number, default: null },
        hard: { type: Number, default: null },
        expert: { type: Number, default: null },
      },
    },
  },
  { timestamps: true }
);

// Prevent compiling model multiple times during Next.js hot-reloads
const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
