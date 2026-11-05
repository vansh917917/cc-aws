import test from 'node:test';
import assert from 'node:assert';
import http from 'http';
import app from '../src/app.js';

let server;
let baseUrl;

test.before((t, done) => {
  server = http.createServer(app);
  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
    done();
  });
});

test.after((t, done) => {
  server.close(done);
});

test('GET /api/health returns healthy status and local driver info', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.status, 'healthy');
  assert.strictEqual(data.storage.driver, 'local');
});

test('GET /api/files returns an array of files', async () => {
  const res = await fetch(`${baseUrl}/api/files`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.ok(Array.isArray(data.data.files));
});

test('POST /api/files, GET download, and DELETE /api/files/:key lifecycle', async () => {
  const formData = new FormData();
  const fileBlob = new Blob(['Hello AWS Learning Project! Content for testing.'], {
    type: 'text/plain'
  });
  formData.append('file', fileBlob, 'sample_assignment.txt');

  const uploadRes = await fetch(`${baseUrl}/api/files`, {
    method: 'POST',
    body: formData
  });

  assert.strictEqual(uploadRes.status, 201);
  const uploadData = await uploadRes.json();
  assert.strictEqual(uploadData.success, true);
  assert.ok(uploadData.data.key);
  assert.strictEqual(uploadData.data.originalName, 'sample_assignment.txt');

  const fileKey = uploadData.data.key;

  const listRes = await fetch(`${baseUrl}/api/files`);
  const listData = await listRes.json();
  const found = listData.data.files.find((f) => f.key === fileKey);
  assert.ok(found, 'Uploaded file should be in file list');

  const downloadRes = await fetch(`${baseUrl}/api/files/${fileKey}/download`);
  assert.strictEqual(downloadRes.status, 200);
  const textContent = await downloadRes.text();
  assert.strictEqual(textContent, 'Hello AWS Learning Project! Content for testing.');

  const deleteRes = await fetch(`${baseUrl}/api/files/${fileKey}`, {
    method: 'DELETE'
  });
  assert.strictEqual(deleteRes.status, 200);
  const deleteData = await deleteRes.json();
  assert.strictEqual(deleteData.success, true);

  const downloadAfterDelete = await fetch(`${baseUrl}/api/files/${fileKey}/download`);
  assert.strictEqual(downloadAfterDelete.status, 404);
});
