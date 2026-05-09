import { test, expect } from '@playwright/test';

/**
 * Sample API tests. Playwright's `request` fixture lets you exercise REST
 * endpoints without a browser, which is great for backend smoke checks.
 */
test.describe('Sample API tests @api', () => {
  test('GET /todos/1 returns expected shape', async ({ request }) => {
    const response = await request.get('https://jsonplaceholder.typicode.com/todos/1');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      id: 1,
      userId: expect.any(Number),
      title: expect.any(String),
      completed: expect.any(Boolean),
    });
  });

  test('POST /posts creates a record', async ({ request }) => {
    const response = await request.post('https://jsonplaceholder.typicode.com/posts', {
      data: { title: 'demo', body: 'hello', userId: 1 },
    });
    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.title).toBe('demo');
  });
});
