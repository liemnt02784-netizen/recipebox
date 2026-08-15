import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('RecipeController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/recipe (GET) trả về danh sách recipe có sẵn', () => {
    return request(app.getHttpServer())
      .get('/recipe')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
      });
  });

  it('/recipe/:id (GET) trả về đúng recipe theo id', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/recipe')
      .send({
        name: 'Recipe Lookup',
        authorEmail: 'e2e@test.com',
        description: 'mo ta',
        imgUrl: 'https://example.com/x.jpg',
        ingredients: [],
      })
      .expect(201);

    const id = createRes.body.id;

    await request(app.getHttpServer())
      .get(`/recipe/${id}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBe(id);
        expect(res.body.name).toBe('Recipe Lookup');
      });
  });

  it('/recipe/:id (GET) trả 404 khi id không tồn tại hoặc sai định dạng', async () => {
    await request(app.getHttpServer()).get('/recipe/000000000000000000000000').expect(404);
    await request(app.getHttpServer()).get('/recipe/not-a-valid-id').expect(404);
  });

  it('/recipe (POST) tạo recipe mới rồi lấy lại được qua GET', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/recipe')
      .send({
        name: 'Recipe E2E',
        authorEmail: 'e2e@test.com',
        description: 'mo ta e2e',
        imgUrl: 'https://example.com/e2e.jpg',
        ingredients: [{ name: 'Muoi', measure: '1 thia', quantity: 1, unit: 'thia' }],
      })
      .expect(201);

    expect(createRes.body.id).toBeDefined();
    expect(createRes.body.name).toBe('Recipe E2E');

    await request(app.getHttpServer())
      .get(`/recipe/${createRes.body.id}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.name).toBe('Recipe E2E');
      });
  });

  it('/recipe/:id (PATCH) cập nhật recipe', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/recipe')
      .send({
        name: 'Recipe Truoc Sua',
        authorEmail: 'e2e@test.com',
        description: 'mo ta',
        imgUrl: 'https://example.com/x.jpg',
        ingredients: [],
      })
      .expect(201);

    const id = createRes.body.id;

    await request(app.getHttpServer())
      .patch(`/recipe/${id}`)
      .send({ name: 'Recipe Da Sua' })
      .expect(200)
      .expect((res) => {
        expect(res.body.name).toBe('Recipe Da Sua');
      });
  });

  it('/recipe/:id (DELETE) xóa recipe rồi GET lại trả 404', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/recipe')
      .send({
        name: 'Recipe Se Bi Xoa',
        authorEmail: 'e2e@test.com',
        description: 'mo ta',
        imgUrl: 'https://example.com/x.jpg',
        ingredients: [],
      })
      .expect(201);

    const id = createRes.body.id;

    await request(app.getHttpServer()).delete(`/recipe/${id}`).expect(200);
    await request(app.getHttpServer()).get(`/recipe/${id}`).expect(404);
  });
});
