import express from 'express';
import { registerUser, loginUser } from '../controllers/auth.controller';

const router = express.Router();

router.post('/register', (req, res, next) => {
  Promise.resolve(registerUser(req, res)).catch(next);
});
router.post('/login', (req, res, next) => {
  Promise.resolve(loginUser(req, res)).catch(next);
});

export default router;
