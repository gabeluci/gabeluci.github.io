---
layout: default
title: "Setting up my own instance"
category: "Staticman"
permalink: /staticman/:year/:month/:day/:title:output_ext
comments: true
---

# {{page.category}}: {{page.title}}

I decided to use Staticman for comments on this site for reasons I described in [my other article]({% post_url 2019-01-04-staticman-comments-for-jekyll %}). Staticman had a public API that anyone was free to use. However, so many people were using it that it started to hit the maximum usage that the GitHub API allows. So [it is now recommended to run your own instance](https://github.com/eduardoboucas/staticman/issues/317#issuecomment-565250060). You can host for free on Heroku. In fact, there's a nifty "Deploy to Heroku" button on the [README](https://github.com/eduardoboucas/staticman#introduction) page (which wasn't there when I first wrote this). But already have a server I could host it on.

Of course, nothing is easy, so I had a ton of trouble setting it up. A couple issues I faced were:

- The VPS that I already have doesn’t have much RAM. So little in fact that I couldn’t run `npm install`.
- A few settings that documentation glossed over, which I couldn’t figure out how to populate properly at first.

So let me describe my adventure. Feel free to skip the sections that aren't relevant to you.

## Install NodeJS

Staticman is written in [NodeJS](https://nodejs.org), so I had to install it on my server. The VPS I already have ($15/year from [ChicagoVPS](https://www.chicagovps.net/services/cloud-vps)) has only 128MB of RAM and originally ran Ubuntu Trusty (14.04), but I've since updated it to Xenial (16.04). Not a whole lot of power, and an old version of Ubuntu, but it has served me well for the [tiny websites](https://convertgasprices.com) I have running on there.

I found out the hard way that the version of NodeJS in the Ubuntu Trusty repository is a *really* old version that didn't work at all with Staticman. Instead, I needed to add a repository to apt before installing NodeJS. Even after I updated to Xenial, I found that NodeJS installed from the Ubuntu repository didn't work as expected, so I suggest you use the NodeJS repositories.

The process is described [here](https://github.com/nodesource/distributions/blob/master/README.md#debinstall). Choose the version of NodeJS you want to install and run the commands they show you. For Trusty, I had to install NodeJS version 10. If you're running a newer version of Ubuntu, use the latest version.

Many NodeJS apps (including Staticman) rely on an environment variable called `NODE_ENV`, which indicates the environment you are running in (development, production, etc.). To add a [system-wide environment variable](https://help.ubuntu.com/community/EnvironmentVariables#System-wide_environment_variables) in Ubuntu, edit the `/etc/environment` file and add this line (I only have one server for this, so I'm calling it "production"):

    NODE_ENV=production

## Download the Staticman code

The Staticman project on GitHub does have some instructions on [Setting up the server](https://github.com/eduardoboucas/staticman#setting-up-the-server), and it makes it sound easy. It wasn't so easy for me.

I knew I wanted the code in `/var/www/staticman`, so I change directories to `/var/www` (the `staticman` directory will be created when we clone the repository):

    cd /var/www

The Staticman instructions say to run this:

    git clone git@github.com:eduardoboucas/staticman.git

However, that failed. Not being terribly experienced with Git, it took me a while to figure out that when you use `git@github.com:`, it is actually using the [SSH protocol](https://gist.github.com/grawity/4392747) to connect, which requires that you already have an RSA key created on your computer and added to your GitHub account so it can authenticate you. We will actually end up doing that later, but for now, it makes a whole lot more sense to just use HTTPS:

    git clone https://github.com/eduardoboucas/staticman
    
I did end up changing some code in Staticman for some features I wanted, which I described in [my other article]({% post_url 2019-01-04-staticman-comments-for-jekyll %}). If you want to use my fork, use this:

    git clone --single-branch --branch accepted-notifications https://github.com/gabeluci/staticman.git

## `npm install` Killed!

The next step is to run `npm install` to download all the dependencies. Well that just didn't work. It ran for a couple seconds, then gave me the message: `Killed`

That, too, took me a while to figure out. It turns out that's what happens when it runs out of memory. Y'know, because my VPS only has 128MB of RAM. So you can skip this section if you're running this on a real computer.

A popular recommendation is to just create a swap partition (or increase the size if you already have one), but my VPS didn't allow me to have a swap partition.

I ended up finding [this Gist](https://gist.github.com/SuperPaintman/851b330c08b2363aea1c870f0cc1ea5a) that someone made for just this purpose. It's a bash script that does everything that `npm install` would do, but without using as much memory. Someone who commented in that Gist provided the commands to download and run that script:

    curl -o npm-f3-install.sh https://gist.githubusercontent.com/SuperPaintman/851b330c08b2363aea1c870f0cc1ea5a/raw/4d3e792c6a54def095f451eeedc50d33ae361339/npm-f3-install.sh
    sudo chmod +x npm-f3-install.sh
    ./npm-f3-install.sh all -s

I added the `-s` to run it in silent mode, since even outputting to the console takes memory, which we want to avoid.

However, that doesn't always work. The easiest fallback is to use another computer, even a Windows computer will work if you have NodeJS installed. Clone the code and run `npm install` on that computer, then copy the entire `node_modules` folder over to your server.

Now let's switch gears for a moment and

## Create a new GitHub "bot" account

You *could* let Staticman use your own personal GitHub account, and I thought about doing that, but decided against it for one main reason: If this gets hacked or otherwise goes haywire, I don't want my personal account affected.

GitHub does allow you to create a separate account for automation. To quote their [Differences between user and organization accounts](https://help.github.com/articles/differences-between-user-and-organization-accounts/) article:

> User accounts are intended for humans, but you can give one to a robot, such as a continuous integration bot, if necessary.

A "bot" account on GitHub really is no different than any other user account. So to create it, just log out of your own GitHub account, then go through the sign-up procedure again. I just appended "-bot" to my normal username to create [@gabeluci-bot](https://github.com/gabeluci-bot).

## The config file

Back at our server, we need to create our config file for Staticman and put the right values in it. Since we set the `NODE_ENV` variable to "production", I created a production config file, based on the sample config:

    cp config.sample.json config.production.json

The [Staticman documentation](https://github.com/eduardoboucas/staticman#setting-up-the-server) simply says,

> Edit the newly-created config file with your GitHub access token, SSH private key and the port to run the server.

So let's look at each of those.

### GitHub Access Token

GitHub's documentation for [creating an access token](https://help.github.com/articles/creating-a-personal-access-token-for-the-command-line/) is pretty good, so do that and copy the new access token into the `githubToken` property in the config file.

### RSA Key

Wait, I thought you said SSH key? I'll explain.

The [Requirements](https://github.com/eduardoboucas/staticman#requirements) section of the Staticman docs says you need:

> An SSH key (click [here](https://help.github.com/articles/connecting-to-github-with-ssh/) to learn how to create one)

That link goes to GitHub's documentation on creating an RSA key and associating it to your GitHub account so that it can be used for authentication when connecting to GitHub via SSH. But Staticman doesn't use it for that at all. **Staticman only uses this key for encryption, nothing else.**

At first, I followed GitHub's documentation and got burned because Staticman (or more-specifically, the [node-rsa](https://github.com/rzcoder/node-rsa) module) expects the key to be in [PEM format](https://en.wikipedia.org/wiki/Privacy-Enhanced_Mail). But the instructions that GitHub gives you does not create it in PEM format. It took me a while to figure that out and convert my key to PEM format.

So **save yourself some time** and ignore GitHub's documentation on the matter and just create an RSA key in PEM format:

    openssl genrsa -out key.pem

Take the contents of `key.pem`, remove all line breaks (or replace them with `\n` - it doesn't really matter which) and paste that into the `rsaPrivateKey` property of your config file.

### Port

The `port` you choose is up to you. I already had Apache running on my server, so I knew I would have to use Apache as a proxy between the outside world and Staticman, so I chose port 8080.

At this point you should be able to run `npm start` and it should work! If so, hit Ctrl+C. There's more work to do.

Since I will be using Apache as a proxy, I want to prevent the outside world from *directly* accessing Staticman on port 8080, I edited [line 174 in `server.js`](https://github.com/eduardoboucas/staticman/blob/master/server.js#L174) so that it would only listen on the local loopback IP (127.0.0.1). This ensures that *only* Apache can access it:

```js
this.instance = this.server.listen(config.get('port'), '127.0.0.1', () => {
```

> This specific change is not in my fork. If you want this, you will have to change it yourself.

## Make Staticman a Service

We want Staticman to start when the server starts and restart if it fails for whatever reason - just stay running! I already knew I could run services (like Apache) with `service apache2 start`, so I wanted to set this up the same way. When I originally set this up, I was running

### Modern versions of Ubuntu (15.04+)

Ubuntu's service manager is called [systemd](https://www.freedesktop.org/wiki/Software/systemd/). Setting up Staticman to be a service is as easy as creating the file `/etc/systemd/system/staticman.service` with this content:

```
[Unit]
Description=Staticman
After=network.target

[Service]
Environment=NODE_ENV=production
Type=simple
User=daemon
ExecStart=/usr/bin/node /var/www/staticman/index.js
Restart=on-failure
RestartSec=30
StartLimitIntervalSec=0

[Install]
WantedBy=multi-user.target
```

That tells systemd to run Staticman after the network is up and to restart it if it fails. The `RestartSec` and `StartLimitIntervalSec` lines tell it to restart after 30 of a failure and to never stop retrying. Because my VPS has such low memory, it would periodically crash when other jobs ran. But then systemd would restart it immediately, which would fail again and systemd would stop trying. Adding those lines gives other jobs the chance to finish and free up memory before retrying and make sure it always keeps trying to bring it back up. The sensible solution is really just to have a server with more than 128MB of RAM.

Then enable the service to make sure it runs at startup:

```bash
systemctl enable staticman
```

Then you can run the service:

```bash
service staticman start
```

### Ubuntu Trusty (14.04)

Older versions of Ubuntu use [Upstart](http://upstart.ubuntu.com/). Once I figured that out, I could search for the right thing and found [this](https://gist.github.com/willrstern/3510ecef59c3f76b0152). It was as easy as creating a file called `/etc/init/staticman.conf` with this content:

```
start on filesystem and started networking
respawn
chdir /var/www/staticman
env NODE_ENV=production
exec /usr/local/bin/node /var/www/staticman/index.js
```

Then I could run the service:

```bash
service staticman start
```

## Setup Apache as a Proxy

To let the world access my Staticman instance, I need to tell Apache to proxy any traffic looking for the domain name I setup (`comments.gabescode.com`) to Staticman. To do that, I created a file called `/etc/apache2/sites-available/comments.gabescode.com.conf` with this content:

```apacheconf
<VirtualHost *:80>
    ServerName comments.gabescode.com

    ErrorLog ${APACHE_LOG_DIR}/error.log
    CustomLog ${APACHE_LOG_DIR}/comments.gabescode.access.log combined

    DocumentRoot /var/www
    ProxyPass /.well-known/ !
    ProxyPass / http://localhost:8080/
    ProxyPassReverse / http://localhost:8080/
</VirtualHost>
```

The key is the last couple lines, which tells Apache to proxy the traffic to port 8080 (the trailing slashes are important, by the way).

These two lines:

```apacheconf
DocumentRoot /var/www
ProxyPass /.well-known/ !
```

are for [Let's Encrypt](https://letsencrypt.org/), which I'll talk more about later. That `ProxyPass` directive *must* come before the others. It tells Apache to *not* proxy any requests to the `.well-known` directory, which Let's Encrypt uses to verify you own the domain. The `DocumentRoot` directive ensures those requests will serve any files in `/var/www/.well-known`.

Just make sure you have the proxy module enabled:

```bash
sudo a2enmod proxy_http
```

Once that was setup, I could enable the site:

```bash
a2ensite comments.gabescode.com
service apache2 reload
```

At this point, I could go to [http://comments.gabescode.com](http://comments.gabescode.com) and see the message "Hello from Staticman version 3.0.0!"

Awesome!

## Create the SSL Site

It's a good idea to use HTTPS for this. We aren't accepting credit card numbers, but we are submitting people's email addresses, and it would be unfortunate if someone started intercepting those.

I was already using [Let's Encrypt](https://letsencrypt.org/) for my other sites, so I already had [acmetool](https://github.com/hlandau/acme) installed. If you don't, look at that documentation for instructions on installing.

To request a certificate, it was as easy as running this:

    acmetool want comments.gabescode.com

That will create a special file in `/var/www/.well-known/acme-challenge`, then make a request to get the file through the domain you are requesting: `https://comments.gabescode.com/.well-known/acme-challenge/{file}`. That verifies that you own the domain. Then the certificate will be created in `/var/lib/acme/live/comments.gabescode.com`.

> Note: If you just installed `acemetool`, make sure you setup a cron job that will run `acmetool reconcile` once a month so that it will automatically renew your certificates.

Now we can create our SSL site. To do this, I created a new site configuration file: `/etc/apache2/sites-available/comments.gabescode.com.ssl.conf`. It looks very similar to the last one, except for the port and the SSL-specific stuff at the end:

```apacheconf
<VirtualHost *:443>
    ServerName comments.gabescode.com

    ErrorLog ${APACHE_LOG_DIR}/error.log
    CustomLog ${APACHE_LOG_DIR}/comments.gabescode.access.log combined

    DocumentRoot /var/www
    ProxyPass /.well-known/ !
    ProxyPass / http://localhost:8080/
    ProxyPassReverse / http://localhost:8080/

    SSLEngine on

    SSLCertificateFile      /var/lib/acme/live/comments.gabescode.com/cert
    SSLCertificateKeyFile   /var/lib/acme/live/comments.gabescode.com/privkey
    SSLCertificateChainFile /var/lib/acme/live/comments.gabescode.com/chain
</VirtualHost>
```

Now I can enable the site:

    a2ensite comments.gabescode.com.ssl
    service apache2 reload

And test that I can visit the site: [https://comments.gabescode.com](https://comments.gabescode.com).

Looks good!

## Debugging

If you run into problems at any point, stop the service (`service staticman stop`) and just run `npm start` from the console. Then if any errors happen, you'll see them on the console. This will be handy for debugging any errors later when you start using it.

## Keep Other People Out

Staticman is designed to be a public API. As such, once you setup a Staticman instance, *anyone* can use it for their own website, if they know about it. If you're ok with that, cool! But as discussed, my VPS is strapped for resources, and I just gave you all the information you need to know to use my instance :) so I decided to lock it down. I did that by adding this line to the Apache config files for both sites (HTTP and HTTPS):

```apacheconf
ProxyPass /v2/connect !
```

That should go before the other `ProxyPass` directives.

A crucial step in setting up Staticman for your site is to make a request to `/v2/connect/GITHUB-USERNAME/GITHUB-REPOSITORY`, which tells Staticman to accept the invitation to become a collaborator in your GitHub repository. Adding this `ProxyPass` directive ensures these requests never actually make it to Staticman.

Just **make sure you do this *after* you have completely setup your comments**, since you will need to use this in your own setup.

In [my other article]({% post_url 2019-01-04-staticman-comments-for-jekyll %}), I show how I set up this site to use my new instance of Staticman.
