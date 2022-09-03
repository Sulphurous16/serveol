import { 
  createServer, 
  IncomingHttpHeaders,
  IncomingMessage,
  ServerResponse,
} from "http";


type HTTPMethods = 
"GET" 
| "POST" 
| "HEAD"
| "OPTIONS"
| "PUT"
| "DELETE"
| "PATCH"
| "CONNECT"
| "TRACE"
| "ALL"
| "NONE";

interface HandlerResponseHeaders {
  [key :string] :string | number | readonly string[];
}

class InvalidRouteProvidedError extends Error {
  constructor() {
    super("[InvalidRouteProvidedError]");
    this.message = "the route you provided to handle was incorrectly formatted";
  }
}

class HandlerRequest {
  public body :string | Record<string, string>;
  public headers :IncomingHttpHeaders;
  public method :HTTPMethods;
  public url :URL;
  constructor(req :IncomingMessage) {
    this.body = {};
    this.headers = req.headers;
    this.method = req.method as HTTPMethods;
    this.url = new URL(req.url ?? "", `http://${req.headers.host}/`);
  }
}

interface HandlerContextAddons {
  [key :string] :(req :HandlerRequest) => unknown;
}

interface HandlerContext {
  req :HandlerRequest;
}

interface HandlerResponse {
  headers :HandlerResponseHeaders;
  status :number;
  body :Record<string, unknown> | string;
}



class RouteHandler {
  public method :HTTPMethods;
  public route :string;
  constructor() {
    this.method = "NONE";
    this.route = "";
  }
  async respond(ctx :HandlerContext) :Promise<HandlerResponse> {
    return {
      headers: {},
      status: 404,
      body: {
        error: "RESOURCE_NOT_FOUND"
      }
    };
  }
}



function mapURLtoParams(requestRoute :string, paramsRoute :string) :object {
  let requestRouteArr = requestRoute.split("/");
  let paramsRouteArr = paramsRoute.split("/");
  let returnedObject = Object.create({});
  for (let i = 0; i < paramsRouteArr.length; i++) {
    if (paramsRouteArr[i].startsWith(":")) {
      returnedObject[paramsRouteArr[i].slice(1)] = requestRouteArr[i];
    }
  }
  return returnedObject;
}

function mapURLtoQuery(requestRoute :string, host :string, port :number, protocol :string) :URLSearchParams {
  let rawURL = `${protocol}://${host}:${port}/${requestRoute}`;
  return new URLSearchParams(rawURL);
}



function checkIfRouteMatchesURL(route :string, url? :string) :boolean {
  if (route.split("/").length !== url?.split("/").length) {
    return false;
  }
  else return true;
}

function parseToFormData(chunk :string) :Record<string, string> {
  return Object.fromEntries(
    chunk.split("&")
    .map(kvPair => kvPair.split("="))
  );
}

class HTTPServer {
  private _routes :Set<RouteHandler>;
  constructor(public port :number = 3000) {
    this._routes = new Set<RouteHandler>();
  }

  public addHandler(handler :RouteHandler) {
    this._routes.add(handler);
    return this;
  }
  public listen() {
    console.log(`Beginning service on ::${this.port}`);
    const _server = createServer((req, res) => {
      req.on("data", (chunk) => {
        let incomingContentType = req.headers["content-type"];
        this._routes.forEach((_rh) => {
          if (
            _rh.method === req.method?.toUpperCase()
          && checkIfRouteMatchesURL(_rh.route, req.url)
          ) {
            req.on("data", (chunk :any) => {
              let _chunk = chunk.toString("utf");
              const reqWrapper = new HandlerRequest(req);
              if (incomingContentType === "application/json") {
                reqWrapper.body = JSON.parse(_chunk);
              }
              else if (incomingContentType === "x-www-form-urlencoded") {
                reqWrapper.body = parseToFormData(_chunk);
              }
              else {
                reqWrapper.body = _chunk;
              }
              _rh.respond({ req: reqWrapper })
              .then((response :HandlerResponse) => {
                for (let header in response.headers) {
                  res.setHeader(header, response.headers[header]);
                }
                res.statusCode = response.status;
                res.write(response.body);
                res.setDefaultEncoding("utf8");
                res.end();
              })
              .catch(console.error);

            });
          }
        })
        
      });
    });
    _server.listen(this.port);
  }

}




export default HTTPServer;