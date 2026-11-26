import axios from "axios";

// The auth token is stored in an httpOnly cookie issued by the backend, so
// the browser attaches it automatically. `withCredentials` is required for
// that cookie to be sent on cross-origin requests as well.
export const axiosInstance = axios.create({
  withCredentials: true,
});

// Authentication is cookie based: the backend reads the httpOnly `token`
// cookie. Any `Authorization` header coming from the app is therefore
// stripped, which guarantees the JWT is never exposed to JavaScript.
const stripAuthorizationHeader = (headers) => {
  if (!headers) return null;

  const { Authorization, authorization, ...rest } = headers;
  return Object.keys(rest).length > 0 ? rest : null;
};

export const apiConnector = (method, url, bodyData, headers, params) => {
  return axiosInstance({
    method: `${method}`,
    url: `${url}`,
    data: bodyData ? bodyData : null,
    headers: stripAuthorizationHeader(headers),
    params: params ? params : null,
  });
};
