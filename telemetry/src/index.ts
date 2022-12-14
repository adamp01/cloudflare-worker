/**
 * Worker that can accept telemetry requests and deliver data to R2.
 */
import { AwsClient } from 'aws4fetch';

export interface Env {
  R2_BUCKET: R2Bucket;
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  S3_BUCKET: string;
  BACKEND: string;
}

const NAMESPACES = ['telemetry'];
// 20MB
const MAXIMUM_CONTENT_LENGTH = 20971520;
const MAXIMUM_PATH_LENGTH = 500;

async function uploadToR2(env: Env, key: string, body: ReadableStream) {
  const r2Obj = await env.R2_BUCKET.put(key, body);
  if (r2Obj && r2Obj.size) {
    return new Response('OK', { status: 200 });
  }
  return new Response('Error Storing Ping', { status: 500 });
}

async function uploadToS3(env: Env, key: string, body: ReadableStream) {
  const aws = new AwsClient({
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY
  });

  // Define required params
  const params = {
    Bucket: env.S3_BUCKET,
    Region: 'us-west-2',
    Key: key,
    Body: body
  };

  const endpoint = `https://${params.Bucket}.s3.${params.Region}.amazonaws.com/`;

  try {
    const response = await aws.fetch(endpoint + params.Key, {
      body: params.Body,
      method: 'PUT'
    });

    if (!response.ok) {
      return new Response("Couldn't store ping on S3.", { status: 424 });
    }

    return new Response('OK', { status: 200 });
  } catch (ex) {
    console.error(env, `Error uploading ${params.Key} to S3.`, ex);
  }

  return new Response('Error Storing Ping', { status: 500 });
}

async function handleRequest(env: Env, request: Request, url: URL) {
  // Split path
  const path = url.pathname;
  const parts = path.split('/');

  // Get Content-Length header
  const contentLength = parseInt(request.headers.get('Content-Length'));
  if (!contentLength) {
    return new Response('Missing Content-Length Header', { status: 411 });
  } else if (contentLength > MAXIMUM_CONTENT_LENGTH) {
    // Need to implement logic to return 202 if we receive too many requests from a client here.
    return new Response('Request Body Too Large', { status: 413 });
  }

  if (parts.length < 9 || !request.body) {
    // We are gonna get an IndexError at the next step otherwise
    return new Response('Bad Request', { status: 400 });
  }

  const namespace = parts[2];
  // namespace/docType/appVersion/appUpdateChannel/appBuildID/docId
  const key = [parts[2], parts[4], parts[6], parts[7], parts[8], parts[3]].join(
    '/'
  );

  // Verify path length
  if (path.length > MAXIMUM_PATH_LENGTH) {
    return new Response('Request Path Too Long', { status: 414 });
  }

  // Ensure a known namespace
  if (!NAMESPACES.includes(namespace)) {
    return new Response('Unknown Namespace', { status: 404 });
  }

  if (env.BACKEND === 's3') {
    return await uploadToS3(env, key, request.body);
  }
  return await uploadToR2(env, key, request.body);
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    switch (request.method) {
      case 'GET':
        switch (url.pathname) {
          case '/status':
            return new Response('OK', { status: 200 });
          default:
            return new Response('Method Not Allowed', { status: 404 });
        }
      case 'POST':
      case 'PUT':
        return await handleRequest(env, request, url);
      default:
        return new Response('Wrong Request Type', { status: 405 });
    }
  }
};
