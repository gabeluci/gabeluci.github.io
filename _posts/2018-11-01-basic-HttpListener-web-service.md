---
layout: default
title: "Create a basic HttpListener web service"
category: ".NET"
permalink: /dotnet/:year/:month/:day/:title:output_ext
comments: true
---

# {{page.category}}: {{page.title}}

Sometimes you need to run tasks in the background, which is a job well-suited for Windows services;
they're designed to stay running all the time. However, you will often want some kind of front-end
to monitor what the service is doing. If your Windows service writes to a database, then you can use that:
your front-end can just read from the database. But if not, you will want your front end to be able to
communicate with your service directly.

You could build some kind of custom way of communicating, but web services are well-known and easy to work
with from any front-end application. The .NET Framework does provide a class to create your own web server:
[`HttpListener`](https://docs.microsoft.com/en-us/dotnet/framework/network-programming/httplistener).
It's handy, but you do have to **construct every HTTP response from scratch**, which is different than writing
something in ASP.NET, for example.

In this example, I'll show you how to use that to create a simple web service in any application (like a Windows service) so other applications can communicated with it.

## Caveat

Note that this example **does not provide any authentication mechanism**. It listens on `localhost`, so
if your front-end is running on the same server, then this should work just fine as long as the port 
you use for this is not exposed to the internet. Otherwise, you will have to implement some kind of authentication.
It should be easy enough to inspect the HTTP header for an API key, for example.

## What does it do?

In this example, the service will either return its current settings via `GET http://localhost:8888/settings`,
or accept new settings via `PUT http://localhost:8888/settings`. Otherwise it will return an `HTTP 404` response.

## How to use

To use this, call `WebService.StartWebServer()` when your application starts, and `WebService.StopWebServer()` to shut it down gracefully.
The `StopWebServer()` method is written so that, if it happens to be currently processing a request, it will wait until it is done
rather than kill it.

```c#
using Newtonsoft.Json;
using System;
using System.IO;
using System.Net;
using System.Text;
using System.Threading.Tasks;

namespace MyService {
    internal static class WebService {
        /// <summary>
        /// The port the HttpListener should listen on
        /// </summary>
        private const int Port = 8888;

        /// <summary>
        /// This is the heart of the web server
        /// </summary>
        private static readonly HttpListener Listener = new HttpListener { Prefixes = { $"http://localhost:{Port}/" } };

        /// <summary>
        /// A flag to specify when we need to stop
        /// </summary>
        private static bool _keepGoing = true;

        /// <summary>
        /// Keep the task in a static variable to keep it alive
        /// </summary>
        private static Task _mainLoop;

        /// <summary>
        /// Call this to start the web server
        /// </summary>
        public static void StartWebServer() {
            if (_mainLoop != null && !_mainLoop.IsCompleted) return; //Already started
            _mainLoop = MainLoop();
        }

        /// <summary>
        /// Call this to stop the web server. It will not kill any requests currently being processed.
        /// </summary>
        public static void StopWebServer() {
            _keepGoing = false;
            lock (Listener) {
                //Use a lock so we don't kill a request that's currently being processed
                Listener.Stop();
            }
            try {
                _mainLoop.Wait();
            } catch { /* je ne care pas */ }
        }

        /// <summary>
        /// The main loop to handle requests into the HttpListener
        /// </summary>
        /// <returns></returns>
        private static async Task MainLoop() {
            Listener.Start();
            while (_keepGoing) {
                try {
                    //GetContextAsync() returns when a new request come in
                    var context = await Listener.GetContextAsync();
                    lock (Listener) {
                        if (_keepGoing) ProcessRequest(context);
                    }
                } catch (Exception e) {
                    if (e is HttpListenerException) return; //this gets thrown when the listener is stopped
                    //TODO: Log the exception
                }
            }
        }

        /// <summary>
        /// Handle an incoming request
        /// </summary>
        /// <param name="context">The context of the incoming request</param>
        private static void ProcessRequest(HttpListenerContext context) {
            using (var response = context.Response) {
                try {
                    var handled = false;
                    switch (context.Request.Url.AbsolutePath) {
                        //This is where we do different things depending on the URL
                        //TODO: Add cases for each URL we want to respond to
                        case "/settings":
                            switch (context.Request.HttpMethod) {
                                case "GET":
                                    //Get the current settings
                                    response.ContentType = "application/json";
                                    
                                    //This is what we want to send back
                                    var responseBody = JsonConvert.SerializeObject(MyApplicationSettings);
                                    
                                    //Write it to the response stream
                                    var buffer = Encoding.UTF8.GetBytes(responseBody);
                                    response.ContentLength64 = buffer.Length;
                                    response.OutputStream.Write(buffer, 0, buffer.Length);
                                    handled = true;
                                    break;
                                    
                                case "PUT":
                                    //Update the settings
                                    using (var body = context.Request.InputStream)
                                    using (var reader = new StreamReader(body, context.Request.ContentEncoding)) {
                                        //Get the data that was sent to us
                                        var json = reader.ReadToEnd();
                                        
                                        //Use it to update our settings
                                        UpdateSettings(JsonConvert.DeserializeObject<MySettings>(json));
                                        
                                        //Return 204 No Content to say we did it successfully
                                        response.StatusCode = 204;
                                        handled = true;
                                    }
                                    break;
                            }
                            break;
                    }
                    if (!handled) {
                        response.StatusCode = 404;
                    }
                } catch (Exception e) {
                    //Return the exception details the client - you may or may not want to do this
                    response.StatusCode = 500;
                    response.ContentType = "application/json";
                    var buffer = Encoding.UTF8.GetBytes(JsonConvert.SerializeObject(e));
                    response.ContentLength64 = buffer.Length;
                    response.OutputStream.Write(buffer, 0, buffer.Length);

                    //TODO: Log the exception
                }
            }
        }

        private static void UpdateSettings(MySettings newSettings) {
            //TODO: Update application settings
        }

    }
}
```
