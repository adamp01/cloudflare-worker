// Mock relevant PostHog endpoints before tests.
beforeEach(() => {
  if (expect.getState().currentTestName.includes('&skipsetup')) {
    return;
  }

  // Get correctly set up `MockAgent`
  const fetchMock = getMiniflareFetchMock();

  // Throw when no matching mocked request is found
  fetchMock.disableNetConnect();

  // PostHog Mocking
  const posthogMock = fetchMock.get(POSTHOG_URL);
  posthogMock
    .intercept({
      method: 'POST',
      path: '/capture/'
    })
    .reply(({ headers }) => ({
      statusCode: 200,
      data: { 'content-length': headers[5] }
    }));

  // Localhost Mocking
  const localMock = fetchMock.get(LOCAL_BASEURL);
  localMock
    .intercept({
      method: 'GET',
      path: '/campaign/',
      query: {
        utm_campaign: '111111111',
        utm_medium: 'test',
        utm_source: 'googletest',
        gclid: 'test'
      }
    })
    .reply(({ path }) => ({ statusCode: 200, data: { path } }));

  localMock
    .intercept({
      method: 'GET',
      path: '/install/',
      query: {
        status: 'install'
      }
    })
    .reply(({ path }) => ({ statusCode: 200, data: { path } }));

  localMock
    .intercept({
      method: 'GET',
      path: '/noevent/'
    })
    .reply(({ path }) => ({ statusCode: 200, data: { path } }));
});

function getFormattedDate() {
  const date = new Date();
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return [year, month, day].join('-');
}
