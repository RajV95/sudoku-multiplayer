import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMatchPlayer {
  userId: mongoose.Types.ObjectId;
  username: string;
  finished: boolean;
  completionTime: number | null; // in seconds or milliseconds
  resigned: boolean;
}

export interface IMatch extends Document {
  roomCode: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  players: IMatchPlayer[];
  winnerId: mongoose.Types.ObjectId | null;
  startedAt: Date;
  endedAt: Date | null;
}

const MatchPlayerSchema = new Schema<IMatchPlayer>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  finished: { type: Boolean, default: false },
  completionTime: { type: Number, default: null },
  resigned: { type: Boolean, default: false },
});

const MatchSchema: Schema<IMatch> = new Schema(
  {
    roomCode: { type: String, required: true },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard', 'expert'],
      required: true,
    },
    players: [MatchPlayerSchema],
    winnerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    startedAt: { type: Date, required: true, default: Date.now },
    endedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const Match: Model<IMatch> = mongoose.models.Match || mongoose.model<IMatch>('Match', MatchSchema);

export default Match;
