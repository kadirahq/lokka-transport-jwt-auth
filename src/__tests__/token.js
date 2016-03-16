import jwt from 'jsonwebtoken';

export function getToken(payload) {
  return jwt.sign(payload, 'secret', {expiresIn: '10m'});
}
