---
layout: default
title: "Recreating Skype for Business Emojis"
category: "Web Development"
permalink: /webdev/:year/:month/:day/:title:output_ext
comments: true
published: false
---

# {{page.category}}: {{page.title}}

I was part of the team that wrote the front-end of the chat interface for our end users to chat with our help desk. Our help desk uses Computer Talk's [ice Contact Center](https://www.computer-talk.com/product/enterprise-contact-center/ice-contact-center) platform to queue and receive both phone calls and chats. The agent receives the chat through Skype for Business (previously called Lync - they never should have changed the name).

Our help desk is almost exclusively for internal employees only. Everyone in our organization has Skype for Business (SfB), so they are all used to it. Since everyone is already used to SfB, and the help desk agents will actually be using SfB, I wanted to support all the same emojis (aka "emoticons") that SfB supports in the front end.

{% include image.html url="/assets/images/sfb-all-emojis.png" description="I want to support all the emojis" %}

## Trouble Begins

I thought it would be easy to find a list of all emojis that SfB supports. But no, it simply doesn't exist. I even tried looking in the exe and dll files looking for strings like `:)` and `:p`, figuring that even if I can find all string values that it converts to *something*, that would be a good start. But I didn't find anything like that.

I did find a couple of websites that did help though. The first was a blog post from 2003 that claimed to be a ["Full List of Emoticons"](https://blog.thoughtstuff.co.uk/2015/03/skype-for-business-full-list-of-emoticons/), but it had a few problems:

- Some didn't make the cut, like smoking, bug, poolparty, sheep
- The shortcodes were not complete (apart from some of them actually being the emoji in the table - not helpful)
- Some are wrong: it gives 4 shortcodes for "dancing", but only `(dance)` actually works

The second helpful page was the [full list of emoticons for Skype](https://support.skype.com/en/faq/FA12330/what-is-the-full-list-of-emoticons) (the consumer version of Skype). While SfB does not come close to supporting the amount of emojis that the consumer Skype does, it was a good reference for finding the shortcodes for some of them that weren't documented anywhere else.

## "Best Effort"

Most people would have stopped here. Or maybe just decided to support a short list of emojis and call it a day. And that's what many people consider "best effort" support: you make an effort, but if it's clear that it will become difficult, and no one *really* expects you to do it, then you call it quits.

But my "best effort" is different. If I *know* that I can get it done, or even see **a clue that I haven't followed yet**, I honestly have a really hard time *not* taking it further.

## The Plan

So my plan was:

1. Build my own table mapping shortcodes to the actual emojis.
2. Use the consumer Skype emojis for the actual images.

To build the mapping table, I used both those websites I mentioned above, but the authority was really just *actually testing* each one. As you can guess, that took a while. At least it felt like a while. It did realisitcally go quick once I got on a roll. I'll share the table I came up with below.

The consumer Skype emojis are actually different than the SfB ones, but I figured that shouldn't matter, right?

## The plan foiled

It turns out that the consumer Skype emojis don't have transparant backgrounds. And our chat design uses a dark-coloured background for one side of the chat. That looked something like this:

<div style="background:#244E68; display: inline-block; padding:10px; border-radius: 10px 10px 10px 0px; color:white; margin-bottom:22px">
    I am so unamused right now <img src="{{site.url}}/assets/images/unamused_40x40.gif" alt="Unamused emoji" height="20" width="20">
</div>

Looks stupid, right? But SfB has a coloured background for one side of the conversation, so clearly **SfB is using transparent images**.

{% include image.html url="/assets/images/im-confused.png" description="Skype for Business is doing it right" %}

## ~~Stealing~~ Borrowing SfB's Images

I started hunting for where SfB stores the images. There weren't any actual image files that I could see, so clearly it wasn't going to be easy.

I finally found the images in a DLL file:
`C:\Program Files (x86)\Microsoft Office\root\Office16\LyncDesktopSmartBitmapResources.dll`

But **they aren't just stored as a GIF file** that I can export and be done. No, of course not. Each frame of the animation is stacked on top of each other. But there are also multiple resolutions (20x20, 25x25, 30x30 and 40x40).

Not only that, but you might have noticed that when you use an emoji, the animation stops after a while and becomes static. But that static image isn't the first or last frame of the animation. It's a totally separate image. That image is also used in the pop-up box that shows you all the emojis. That image is also in the DLL file in all 4 resolutions too.