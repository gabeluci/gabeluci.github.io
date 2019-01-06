---
layout: default
title: "Adding comments to my Jekyll site"
category: "Staticman"
permalink: /staticman/:year/:month/:day/:title:output_ext
comments: true
---

# {{page.category}}: {{page.title}}

I wanted to create a commenting system for this site, which runs on [GitHub Pages](https://pages.github.com/) and [Jekyll](https://jekyllrb.com/). But if I was going to do it, I was going to do it right. I had a few requirements:

1. **Comments should be embedded** into the HTML of the page, not loaded by JavaScript. This is mostly for the sake of SEO: the comments can be indexed with the page.
2. **Allow threads**, so it's clear that one person is replying to another.
3. **Notify people** that someone replied to their comment.
4. GitHub Pages does not allow any Jekyll plugins (at least not if you want to let GitHub build the site), so **I didn't want any plugins**.
5. **Moderate comments**: no matter how much "I am not a robot" logic you put on your page, there will still be people (likely manually) posting useless comments for the sole purpose of injecting a link to their website.

After doing some research, I decided on [Staticman](https://staticman.net/), which works perfectly with GitHub Pages. It works through the GitHub API to commit new comments to your GitHub repository, which of course triggers a rebuild of your page and the new comment will be included in your page. If you prefer to moderate your comments, you can make it send pull requests that you have to approve. Although even if you don't moderate comments, each comment is stored as a separate file, so you can delete comments by just deleting that file.

There are several walk-throughs online about how to set this up, but the ones I found most useful were from [mademistakes.com](https://mademistakes.com/), mostly because he tackled the issue of threading comments, which I ended up expanding on:

> [Going static part 2: static comments](https://mademistakes.com/articles/jekyll-static-comments/)

> [Improving static comments with Jekyll & Staticman](https://mademistakes.com/articles/improving-jekyll-static-comments/)

Because the public Staticman API [is in trouble](https://github.com/eduardoboucas/staticman/issues/222), I decided to [host my own Staticman instance]({% post_url 2019-01-03-create-staticman-instance %}). Read that article if you're curious about how I did it.

This article will cover inplementing the comments into the actual Jekyll pages. However, be aware that there are a few things I did that depend on running my own instance, since I changed the Staticman code to make it happen.

Feel free to skip the sections you don't care about, but:

> Throughout this setup, be sure to replace `api.staticman.net` with your own domain if you hosted your own Staticman instance.

## Connect Staticman to Your Repository

You need to invite the GitHub account for Staticman to be a collaborator in your GitHub project. For the public Staticman instance, that's the [@staticmanapp](https://github.com/staticmanapp) user. Or, if you created your own Staticman instance, it will be the bot account you created. See Step 1 in the Staticman [Getting Started documentation](https://staticman.net/docs/index.html) for how to do that and accept the invitation.

## Configuration file (`staticman.yml`)

Whenever a request is made to the Staticman API, it downloads `staticman.yml` from your repository. You can see mine [here](https://github.com/gabeluci/gabeluci.github.io/blob/master/staticman.yml) and you can see the documentation for it [here](https://staticman.net/docs/configuration), so I won't go into too much detail, except a couple pain points.

### Encryption

Some fields in the config file are encrypted. The Staticman API has an endpoint that will encrypt anything for you. That's described [here](https://staticman.net/docs/encryption), but basically, you just put this in your browser:

    https://api.staticman.net/v2/encrypt/{text to encrypt}

### Mailgun

If you decide to use email notifications, you need to setup your own [Mailgun](https://www.mailgun.com/) account. Doing that is fairly straight-forward. Just go [sign-up](https://signup.mailgun.com/new/signup). But you should use a dedicated subdomain just for Mailgun (in my case that is `mg.gabescode.com`). Mailgun walks you through setting up the DNS entries needed for them to activate your domain.

Once your domain is setup in Mailgun, go to the settings page for your domain (from your [Domain List](https://app.mailgun.com/app/domains), click the gear icon and then 'Domain Settings') and copy the "API Key". Encrypt that API key and put it in the `apiKey` property (under `notifications`).

> Note: In some documentation online, I've seen the prefix `key-` put in front of the Mailgun API keys. I used the key *exactly as it appeared* on the Mailgun portal, which *did not include the `key-` prefix*. That is what worked.

Also encrypt the domain you used for Mailgun (in my case, `mg.gabescode.com`) and put that in the `domain` property of your config file. I don't know why this needs to be encrypted since it's public knowledge (it shows up in the emails that go out).

### reCAPTCHA

Spam comments is an awful problem. So I decided to use reCAPTCHA. I don't know if the new [reCAPTCHA v3](https://developers.google.com/recaptcha/docs/v3) will work here (which is designed to not ask the user for anything). I created my reCAPTCHA account using the [v2 checkbox](https://developers.google.com/recaptcha/docs/display).

Take the site key the give you an put it (not encrypted) into the `siteKey` property of the Staticman config.

The "secret" they give you needs to be encrypted and put into the `secret` property.

The site key needs to be read in your Jekyll code (unless you just want to hardcode it - that's fine too), so it's helpful to put that in your [`_config.yml`](https://github.com/gabeluci/gabeluci.github.io/blob/master/_config.yml) too:

```
reCaptcha:
  siteKey: "key"
  secret: "encrypted secret"
```

## Show Comments on the Posts

The actual displaying of the comments and the commenting form I mostly borrowed from [mademistakes.com](https://mademistakes.com/) (the two articles I linked to above), with my own modifications. All of my relevant code is in:

- [My `_includes` folder](https://github.com/gabeluci/gabeluci.github.io/tree/master/_includes)
- [`main.js`](https://github.com/gabeluci/gabeluci.github.io/blob/master/assets/js/main.js)
- [`lazysizes.min.js`](https://github.com/gabeluci/gabeluci.github.io/blob/master/assets/js/lazysizes.min.js) from the [lazysizes](https://github.com/aFarkas/lazysizes) project, to lazy-load the Gravatar pictures (which you may or may not care about)
- [The CSS](https://github.com/gabeluci/gabeluci.github.io/blob/master/assets/css/style.scss#L411) (starting at line 411: `/* Comments */`)

In my [default layout](https://github.com/gabeluci/gabeluci.github.io/blob/master/_layouts/default.html#L61) I just include this:

```
{% raw %}
{% if page.comments == true %}
    {% include comments.html %}
{% endif %}
{% endraw %}
```

Looking for `page.comments == true` makes it opt-in. So you have to put `comments: true` in the front-matter of each post where you want comments to be allowed.

The [`comments.html`](https://github.com/gabeluci/gabeluci.github.io/blob/master/_includes/comments.html) template does a few things:

- Shows the comment count (if there are any)
- Shows each comment, using [`comment.html`](https://github.com/gabeluci/gabeluci.github.io/blob/master/_includes/comment.html) as a template
- Includes the [comment form](https://github.com/gabeluci/gabeluci.github.io/blob/master/_includes/comment-form.html)

I'm not going to explain how everything works there, but I will explain a couple things.

## Comment Threading

The example from [mademistakes.com](https://mademistakes.com/) implemented threading one-level deep, which is awesome. I used most of the front-end code for that unchanged. However, I did change how replies are linked together with the original comment.

He had used a `replying_to` field that holds the index of the original comment in the array of comments. So if you replied to the first comment on that post, then `replying_to` would be `1`. If you replied to the 5th comment, it would be `5`. That works, but if you decide to delete a comment (which is easy because each comment is its own file in `_data/comments`), it would break the threading since the indexes would change (the 5th comment could become the 4th, but `replying_to` would still be `5`).

I changed it so that, when you reply, the `_parent` field (`options[parent]` in the form) is set to the `_id` of the comment you're replying to. The `_id` field is a GUID that is automatically generated in Staticman for each new comment.

I got rid of the `replying_to` field entirely. I had to update his JavaScript to accomodate this.

### What Came First?

This changes how you determine which post is a top-level post an which isn't. Using the `replying_to` field, you could just check if it is blank. Then you know that's the top-level post.

With this new method, we determine the top level post by checking if `_parent == _id`, which [`comments.html` does](https://github.com/gabeluci/gabeluci.github.io/blob/master/_includes/comments.html#L10):

```
{% raw %}
{% assign comments = site.data.comments[page.slug] | sort | where_exp: 'comment', 'comment[1]._parent == comment[1]._id' %}
{% endraw %}
```

But we also have to be careful when looking for the replies. Notice [this line in `comment.html`](https://github.com/gabeluci/gabeluci.github.io/blob/master/_includes/comment.html#L41):

```
{% raw %}
{% capture i %}{{ include.id }}{% endcapture %}
{% assign replies = site.data.comments[page.slug] | sort | where_exp: 'comment', 'comment[1]._id != i' | where_exp: 'comment', 'comment[1]._parent == i' %}
{% endraw %}
```

We have to look for comments where `_parent` is the `_id` of this comment, but remember that the current comment will be in that array still, so we *also* have to include the condition that `_id` is not the current comment. Otherwise, we'll end up in an infinite loop.

## Notifications

For a person to be subscribed to notifications, you have to send a field named `options[subscribe]` with the name of the field that holds the email address (usually, `email`). You can either make this a checkbox to let the user opt-in, or just do what I did and make it a hidden field:

```html
<input type="hidden" name="options[subscribe]" value="email">
```

The email has an unsubscribe link, so they can use that if they decide later they don't want notifications.

### Per-Thread Notifications

The `_parent` field for each comment serves another purpose in Staticman: it defines which mailing list to send notifiations to. When a comment is submitted with a `_parent` value that has never been used before, Staticman will create a mailing list in Mailgun for that value. Every time another comment is made with the same `_parent` value, an email goes out to that mailing list.

Many Staticman users will put the page slug (a URL-friendly version of the page's title) in the `_parent` field. That means that whenever someone comments on a post, *every other person who has commented on the post* will get an email, not *just* the person they're replying to. Even top-level comments will generate a notification to every other person who has commented.

This is really the main reason I decided to put the `_id` of the post you're replying to in `_parent`. But, there's a problem with this: because `_parent` is empty for a top-level comment, the mailing list is not created and the original commenter will not be notified of replies. That's Bad™.

The solution is to copy the `_id` of the top-level comment into `_parent` (so they're equal), but the `_id` isn't known yet because it only gets generated when the post is submitted to Staticman.

This is where running your own instance of Staticman is handy. I ended up modifying the code to copy the `_id` into `_parent` if `_parent` is empty.

First thing inside the [`Staticman.prototype.processEntry`](https://github.com/eduardoboucas/staticman/blob/master/lib/Staticman.js#L456) function, I added this:

```js
Staticman.prototype.processEntry = function (fields, options) {
  if (!options.parent) {
    options.parent = this.uid
  }
  ...
```

So now when a new top-level comment is made, `_parent` is set to the newly-generated `_id` and that is used to create the mailing list.

> **If you're using the public Staticman API**, you could probably do something similar by generating your own unique identifier in JavaScript for top-level comments and put that in `_parent`, then use that in replies too. But then you would another field (called something like `isTopLevelComment`) that indicates what is a top-level a comment and what is not.

Staticman does send out an email right away (even when a top-level comment is made). That's not always desirable, but if you have moderation turned on it does serve the purpose of notifying the person that their comment was approved, although it uses the same email template as a reply, so it says "Someone replied to a comment you subscribed to". I might decide to change that some time, but maybe not.

### From whom?

When I tested the notifications, the `From` line in GMail showed up like this:

> **Staticman** noreply@staticman.net via mg.gabescode.com

I didn't like that. There are two things I wanted to change:

1. The `From` address
2. The display name ("Staticman")

Both have to be changed on the Staticman server. The `From` address can be changed in the config. So I opened my `config.production.config` and added this:

```
"email": {
  "fromAddress": "noreply@mg.gabescode.com"
}
```

That got rid of the whole "via" thing.

There is no configuration option for the display name, so I had to dig into the Staticman code again for that. I opened up [`/lib/Notification.js`](https://github.com/eduardoboucas/staticman/blob/master/lib/Notification.js#L32) and changed it to "Gabe's Code":

```js
from: `Gabe\'s Code <${config.get('email.fromAddress')}>`,
```

Now it looks like this:

> **Gabe's Code** noreply@mg.gabescode.com 

## Webhook!

This is a **crucial step if you have moderation enabled**: You need to setup a webhook in your GitHub repository to notify Staticman when the pull request has been merged. The instructions are [here](https://staticman.net/docs/webhooks) and quite straight-forward.

Staticman does two things when that webhook is triggered:

1. **Deletes the branch** that was created for the pull request, and
2. **Sends the email** notifications (i.e. no email notifications will go out if you have moderation enabled and have not setup your webhook)

## Conclusion

I hope this helps someone. It was a somewhat frustrating experience for me to set this up, but in the end, I'm happy with the way it turned out.

This is the first time I can say this: if you have any comments, feel free to make them below! :)