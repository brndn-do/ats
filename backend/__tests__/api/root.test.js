import request from 'supertest';
import app from '../../src/app.js';

it('should return 200', async () => {
  const res = await request(app).get('/');
  expect(res.status).toBe(200);
});
