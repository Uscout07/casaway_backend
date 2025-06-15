// types/express/index.d.ts
import { IUser } from '../../src/models/User'; // Adjust the import path as necessary
declare namespace Express {
  export interface Request {
    user?: IUser;
    userId?: string;
  }
}
