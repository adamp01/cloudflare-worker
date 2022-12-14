import fs from 'fs';
import worker from '../dist/index.mjs';
// Get env and context
let env;
let ctx;
const STATUS_ENDPOINT = '/status';
const PING_ENDPOINT =
  '/submit/telemetry/ce39b608-f595-4c69-b6a6-f7a436604648/main/Firefox/61.0a1/nightly/20180328030202';
const LONG_ENDPOINT =
  '/IlOHLcMaa7qh27Ogrk0bgoyuI0I1aWUK/dz6mv/yeSevj0h2hH/kqP1hwaade5KUCQIL06eyVEU/bwW46Hr3JtQ9scl/Ew9oU6RCbgfOAZla3EWM/M5adGM6Vk4rXH0y77/I1AtKhcCBYYc4QfP3l/T7SVZZ0yVmg88zdC/2ohixMvvWXHnZGzcZ4SPAkDiFjL2uK1Vn28J7PhPpKnZoKe6DxteSNZOGLvZn9kf2LBWVRZUAmd9Zb526D8GOzdIrE05MuhUc0buZzDjItkc3ryaRKdMdPWDkqMINoYF9enf40VzYXhPO0IHNVF80n9yoUoDsUu2YTHg3XTAc7svlLa2qebWZkpfaCJLzef0AnaHOOwGYvY1aWjypbE3yhI0r148NsbiIeg3HNbmXtRtLWUrsTwtxAQ1hi3oM35orVnAmrzFA0oM46V621dSRUriwa0b1bnwFzqbQwqFyFsz6x4WtJTYYvd5YX67DdAlCZdeeXqEEbABFqZjkae3s2';
const MAXIMUM_CONTENT_LENGTH = 20971520;

beforeEach(async () => {
  env = getMiniflareBindings();
  ctx = new ExecutionContext();
});

test('Test GET on /status', async () => {
  const request = new Request(LOCAL_BASEURL + STATUS_ENDPOINT, {
    method: 'GET'
  });

  const response = await worker.fetch(request, env, ctx);
  expect(await response.text()).toEqual('OK');
  expect(response.status).toEqual(200);
});

test('Test GET fails on any other path', async () => {
  const request = new Request(LOCAL_BASEURL + PING_ENDPOINT, {
    method: 'GET'
  });

  const response = await worker.fetch(request, env, ctx);
  expect(await response.text()).toEqual('Method Not Allowed');
  expect(response.status).toEqual(404);
});

test('Test POST/PUT fails with a URL with too few parts', async () => {
  for (let method of ['POST', 'PUT']) {
    const request = new Request(LOCAL_BASEURL + STATUS_ENDPOINT, {
      method,
      body: {},
      headers: {
        'Content-Length': MAXIMUM_CONTENT_LENGTH
      }
    });

    const response = await worker.fetch(request, env, ctx);
    expect(await response.text()).toEqual('Bad Request');
    expect(response.status).toEqual(400);
  }
});

test('Test too long URL fails', async () => {
  for (let method of ['POST', 'PUT']) {
    const request = new Request(LOCAL_BASEURL + LONG_ENDPOINT, {
      method,
      body: {},
      headers: {
        'Content-Length': MAXIMUM_CONTENT_LENGTH
      }
    });

    const response = await worker.fetch(request, env, ctx);
    expect(await response.text()).toEqual('Request Path Too Long');
    expect(response.status).toEqual(414);
  }
});

test('Test incorrect namespace fails', async () => {
  for (let method of ['POST', 'PUT']) {
    const request = new Request(
      LOCAL_BASEURL + PING_ENDPOINT.replace('telemetry', 'incorrect'),
      {
        method,
        body: {},
        headers: {
          'Content-Length': MAXIMUM_CONTENT_LENGTH
        }
      }
    );

    const response = await worker.fetch(request, env, ctx);
    expect(await response.text()).toEqual('Unknown Namespace');
    expect(response.status).toEqual(404);
  }
});

test('Test no content-length header fails', async () => {
  for (let method of ['POST', 'PUT']) {
    const request = new Request(LOCAL_BASEURL + PING_ENDPOINT, {
      method,
      body: {}
    });

    const response = await worker.fetch(request, env, ctx);
    expect(await response.text()).toEqual('Missing Content-Length Header');
    expect(response.status).toEqual(411);
  }
});

test('Test too large body fails', async () => {
  for (let method of ['POST', 'PUT']) {
    const request = new Request(LOCAL_BASEURL + PING_ENDPOINT, {
      method,
      headers: {
        'Content-Length': MAXIMUM_CONTENT_LENGTH + 1
      }
    });

    const response = await worker.fetch(request, env, ctx);
    expect(await response.text()).toEqual('Request Body Too Large');
    expect(response.status).toEqual(413);
  }
});

test('Test POST/PUT with valid object succeeds', async () => {
  const body = fs.readFileSync('__tests__/data/payload.json');
  for (let method of ['POST', 'PUT']) {
    const request = new Request(LOCAL_BASEURL + PING_ENDPOINT, {
      method,
      body,
      headers: {
        'Content-Length': body.length
      }
    });

    const response = await worker.fetch(request, env, ctx);

    const key = getKeyFromEndpoint(PING_ENDPOINT);
    const r2Obj = await env.R2_BUCKET.get(key);
    expect(r2Obj.size).toEqual(105511);
    expect(response.status).toEqual(200);
  }
});

test('Test POST/PUT with invalid object fails', async () => {
  for (let method of ['POST', 'PUT']) {
    const request = new Request(LOCAL_BASEURL + PING_ENDPOINT, {
      method,
      body: undefined,
      headers: {
        'Content-Length': 105511
      }
    });

    const response = await worker.fetch(request, env, ctx);

    const key = getKeyFromEndpoint(PING_ENDPOINT);
    const r2Obj = await env.R2_BUCKET.get(key);
    expect(r2Obj).toEqual(null);
    expect(response.status).toEqual(400); // This should not be a 500, need another error for missing request body
  }
});

// EXAMPLE ONLY - NOT A WORKING TEST
test('Test mocking in this test only', async () => {
  const path = '/';
  const query = {
    install_date: "10-10-2022"
  };
  const data = {
    ptag: 'None'
  };
  setUpMock("https://test_url.com", path, data, query);
  const request = new Request(LOCAL_BASEURL + PTAG_ENDPOINT, {
    method: 'GET'
  });

  // Call module worker handler
  const response = await worker.fetch(request, env, ctx);
  expect(await response.text()).toEqual(
    '{"message":"Success","ptag":"default"}'
  );
});

// Helpers
function setUpMock(mock, path, data, query) {
  // Get correctly set up `MockAgent`
  const fetchMock = getMiniflareFetchMock();

  // Throw when no matching mocked request is found
  fetchMock.disableNetConnect();
  // Mock
  const mocking = fetchMock.get(mock);
  mocking
    .intercept({
      method: 'GET',
      path,
      query
    })
    .reply(() => ({
      statusCode: 200,
      data
    }));
}

function getKeyFromEndpoint(endpoint) {
  const parts = endpoint.split('/');
  return [parts[2], parts[4], parts[6], parts[7], parts[8], parts[3]].join('/');
}


