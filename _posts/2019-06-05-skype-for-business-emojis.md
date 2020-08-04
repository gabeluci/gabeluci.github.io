---
layout: default
title: "Recreating Skype for Business Emojis"
category: "Web Development"
permalink: /webdev/:year/:month/:day/:title:output_ext
comments: true
---

# {{page.category}}: {{page.title}}

I was part of the team that wrote the front-end of the chat interface for our end users to chat with our help desk. Our help desk uses Computer Talk's [ice Contact Center](https://www.computer-talk.com/product/enterprise-contact-center/ice-contact-center) platform to queue and receive both phone calls and chats. The agent receives the chat through Skype for Business (previously called Lync - they never should have changed the name).

Our help desk is almost exclusively for internal employees only. Everyone in our organization has Skype for Business (SfB), so they are all used to it. Since everyone is already used to SfB, and the help desk agents will actually be using SfB, **I wanted to support all the same emojis** (aka "emoticons") that SfB supports in the front end.

{% include image.html url="/assets/images/sfb-all-emojis.png" description="I want to support all the emojis" %}

## Trouble Begins

I thought it would be easy to find a list of all emojis that SfB supports. But no, **it simply doesn't exist**. I even tried looking in the exe and dll files looking for strings like `:)` and `:p`, figuring that even if I can find all string values that it converts to *something*, that would be a good start. But I didn't find anything like that.

I did find a couple of websites that did help though. The first was a blog post from 2003 that claimed to be a ["Full List of Emoticons"](https://blog.thoughtstuff.co.uk/2015/03/skype-for-business-full-list-of-emoticons/), but it had a few problems:

- Some didn't make the cut, like "smoking", "bug", "poolparty", "sheep"
- The shortcodes were not complete (apart from some of them actually being the emoji in the table on that page - not helpful)
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

{% include image.html url="/assets/images/im-confused.png" description="Skype for Business is doing it right. Why can't I?" %}

## ~~Stealing~~ Borrowing SfB's Images

I started hunting for where SfB stores the images. There weren't any actual image files that I could see, so clearly it wasn't going to be easy.

I finally found the images in a DLL file:
`C:\Program Files (x86)\Microsoft Office\root\Office16\LyncDesktopSmartBitmapResources.dll`

But **they aren't just stored as GIF files** that I can export and be done. No, of course not. Each frame of the animation is stacked on top of each other in one big PNG image. But there are also multiple resolutions (20x20, 25x25, 30x30 and 40x40).

Not only that, but you might have noticed that when you use an emoji in SfB, the animation stops after a while and becomes static. But that static image isn't just the first or last frame of the animation. It's a totally separate image. That image is also used in the pop-up box that shows you all the emojis. That image is also in the DLL file in all 4 resolutions too.

I decided I'm only going to deal with one resolution (20x20). But still, with 110 emojis, and an animation and static image for each, that's not something I want to do by hand. There must be a way to automate some of this.

## Extracting the images

To extract all the images from the DLL, I used [ResourceExtract](https://www.nirsoft.net/utils/resources_extract.html), a free program. I just needed to extract the "Other Binary Resources":

{% include image.html url="/assets/images/resource-extract.png" description="ResourceExtract" %}

All the images we want end up with a file extension of `.bin`, even though they are PNG's. So I renamed them all in the command line:

``` bat
ren *.bin *.png
```

Exploring the files, I found that the emojis start at resource #430, and end at 1405. So I deleted all the other files. But there are still 4 resolutions, and I just want one. In Windows Explorer, when using the "detailed" view, you can right-click the headings and click "More" to add whatever property as a heading. So I added "Width" and "Height". Then I sorted by width and deleted everything that did not have a width of 20. There were still several files I didn't want, but it was manageable. (the "smoking" emoji is actually there, but there is no character combination I could find that uses that)

{% include image.html url="/assets/images/skype-explorer.png" description="All the files before I deleted the larger resolutions" %}

At this point I went through all 220 files and renamed them to the name of the emojis. This was boring, but it had to be done at some point.

## Making the animations

I separated the animations into a new folder by sorting the files by height, and moving all files with a height more than 20.

My original thought was to **make them all into animated GIFs**. But that plan was foiled too. It turns out that each frame of the animations are PNG because they use alpha transparency around the edges. Unfortunately, animated GIFs don't support alpha transparency - pixels are either 100% opaque or 100% transparent. I originally tried to make them GIFs, but then it still only looked good on white backgrounds. So **I had to go with animated PNGs**.

I used [ImageMagick](https://imagemagick.org/) to split the frames of the animation out of the single files. Unfortunately, ImageMagick doesn't support animated PNGs. But this was a start:

``` bat
FOR %f IN (*.png) DO (
    mkdir "%~nf"
    magick "%f" -crop x40 +repage ".\%~nf\%~nf.png"
)
```

That went through every file, created a new folder for that file (with the same name) and created one PNG file for each frame.

To create the animated PNG files, I used another free program: [APNG Assembler](http://apngasm.sourceforge.net/). This is the command I used, which I ran from the parent folder of all the image folders created by ImageMagick:

``` bat
FOR /D %d IN (*) DO (
    apngasm64 "..\%d.png" "%d\%d-*.png"
)
```

That went through every folder and assembled the frames into a single animated PNG in the root folder. Animations complete!

## Using the animations

Our organization still IE11 and Chrome, so the first hurdle was getting IE11 to use the animations, since it doesn't support animated PNGs. I found a wonderful library called [apng-canvas](https://github.com/davidmz/apng-canvas) that will help me do that. Using that library, you can just call `APNG.animateImage(imgElement)` for any image element with an animated PNG.

I found some code online that I can run on page load to test for APNG support, so I'm not running this code unnecessarily on real browsers. This is the code I used:

``` js
var apngTest = new Image(),
    ctx = document.createElement("canvas").getContext("2d");
apngTest.onload = function () {
    ctx.drawImage(apngTest, 0, 0);
    window.APNGSupport = ( ctx.getImageData(0, 0, 1, 1).data[3] === 0 );
};
apngTest.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACGFjVEwAAAABAAAAAcMq2TYAAAANSURBVAiZY2BgYPgPAAEEAQB9ssjfAAAAGmZjVEwAAAAAAAAAAQAAAAEAAAAAAAAAAAD6A+gBAbNU+2sAAAARZmRBVAAAAAEImWNgYGBgAAAABQAB6MzFdgAAAABJRU5ErkJggg==";
```

After that, I can just check `APNGSupport` to see if we're using a real browser.

## Stopping the animations

As discussed earlier, **SfB will stop the animation after a little while**. I like this feature since having a bunch of animations constantly moving on screen can get annoying. SfB loops the animation a specific number of times before stopping, but since I can't count the number of loops in a browser, I decided to just use a hard time limit of 30 seconds.

But to complicate things, the apng-canvas library changes the `img` tag to a `canvas`. So I had to figure out how to follow that change. This is the code I came up with when replacing specific characters (like `:p`) with an emoji, where `emojis` is my array of emoji objects (as defined at the end of this article):

``` js
emojis.forEach(function(e) {
    if (APNGSupport) {
        text = text.replace(e.characters, "<img class='chat-emoji' alt='" + e.characters + "' aria-label='" + e.name.replace("\'", "&#39;") + " emoji' title='" + e.name.replace("\'", "&#39;") + "' src='" + chatSvcRoot + "/images/emoji/" + e.fileName + "_animated.png' onload='var _this = this; setTimeout(function() { _this.src = \"" + chatSvcRoot + "/images/emoji/" + e.fileName + ".png\"; }, 30000);' />");
    } else {
        var className = e.fileName + new Date().valueOf();
        text = text.replace(e.characters, "<img class='chat-emoji " + className + "' alt='" + e.characters + "' aria-label='" + e.name.replace("\'", "&#39;") + " emoji' title='" + e.name.replace("\'", "&#39;") + "' src='" + chatSvcRoot + "/images/emoji/" + e.fileName + "_animated.png' onload=\"APNG.animateImage(this); setTimeout(function() { var elements = document.getElementsByClassName('" + className + "'); for (var i=0; i < elements.length; i++) { var canvas = elements[i]; var newImg = document.createElement('img'); newImg.classList.add('chat-emoji'); newImg.alt='" + e.name.replace("\'", "") + " emoji'; newImg.src='" + chatSvcRoot + "/images/emoji/" + e.fileName + ".png'; canvas.parentNode.replaceChild(newImg, canvas); }}, 30000);\" />");
    }
});
```

That replaces the characters with an image, but also has an `onload` event that will start a timer. When the timer elapses, it replaces the animation with the still image. You'll see the code for IE11 is more complicated, since we need to replace the `canvas` element, not the original `img` element we first created. I created a unique class name to find it (the apng-canvas library will copy the class name to the new `canvas` element).

## The Data

After telling you all this, I'm not going to make you do this yourself (although I'm not entirely sure how many people would really want this). But here are all the images I extracted and used:

<a href="{{ site.url }}/assets/download/sfb-emoji.zip" class="buttons">Download Skype for Business Emojis</a>

That's only the 20x20 images, so if you want any higher resolution, you'll have to do it yourself. Sorry not sorry.

Below is the table I painstakingly compiled of all the possible character combinations that SfB turns into emojis (that I could find), and which emojis they turn into, in JSON format. **The order of these is important**, since you have to look for the longer character sets before the shorter ones. For example, you have to search and replace `:o3` (dog) before you look for `:o` (surprised) otherwise no one will be able to use the dog emoji.

These are the properties I include here:

- `name`: The name that Skype for Business uses in the pop-up emoji chooser.
- `characters`: The characters that should be replaced with the emoji. Most emojis have different character combinations for the same emoji (e.g. `:o` and `:-o`). **These are case-sensitive!** Not all character combinations work with upper and lower case (I tested).
- `fileName`: The name that I used for the image file. Note that adding `.png` will give you the static image, and adding `_animated.png` will give you the animated one.
- `isDefault`: If `true`, then this is the character combination that SfB advertises in the pop-up emoji chooser. The only difference is for the "puke" emoji. SfB is actually wrong. It tells you that `:&` works, but it doesn't. You need to double-up on the ampersand: `:&&`

<button class="btn" onclick="toggleDisplay('emojiJson')">View JSON</button>&nbsp;
<button class="btn" onclick="copyTextFromElement('emojiJson')">Copy JSON to clipboard</button>

<div id="emojiJson" style="display:none">

``` js
[
    { name: "Fingers crossed", characters: "(fingerscrossed)", fileName: "fingerscrossed", isDefault: false },
    { name: "Fingers crossed", characters: "(crossedfingers)", fileName: "fingerscrossed", isDefault: false },
    { name: "Talk to the hand", characters: "(talktothehand)", fileName: "talktothehand", isDefault: true },
    { name: "Lalala", characters: "(notlistening)", fileName: "lalala", isDefault: false },
    { name: "Confidential", characters: "(confidential)", fileName: "confidential", isDefault: true },
    { name: "What's going on?", characters: "(whatsgoingon)", fileName: "whatsgoingon", isDefault: true },
    { name: "Broken heart", characters: "(brokenheart)", fileName: "brokenheart", isDefault: false },
    { name: "Beer", characters: "(bricklayers)", fileName: "beer", isDefault: false },
    { name: "Speechless", characters: "(speechless)", fileName: "speechless", isDefault: false },
    { name: "Waiting", characters: "(impatience)", fileName: "waiting", isDefault: false },
    { name: "Tumbleweed", characters: "(tumbleweed)", fileName: "tumbleweed", isDefault: true },
    { name: "Can you talk", characters: "(canyoutalk)", fileName: "canyoutalk", isDefault: true },
    { name: "Surprised", characters: "(surprised)", fileName: "surprised", isDefault: false },
    { name: "Smiley with tongue out", characters: "(tongueout)", fileName: "tongueout", isDefault: false },
    { name: "Handshake", characters: "(handshake)", fileName: "handshake", isDefault: true },
    { name: "Facepalm", characters: "(facepalm)", fileName: "facepalm", isDefault: true },
    { name: "High five", characters: "(highfive)", fileName: "highfive", isDefault: true },
    { name: "Banging head on wall", characters: "(headbang)", fileName: "headbang", isDefault: true },
    { name: "Banging head on wall", characters: "(banghead)", fileName: "headbang", isDefault: false },
    { name: "Gotta run", characters: "(gottarun)", fileName: "gottarun", isDefault: true },
    { name: "Bartlett", characters: "(bartlett)", fileName: "bartlett", isDefault: true },
    { name: "Bartlett", characters: "(football)", fileName: "bartlett", isDefault: false },
    { name: "Heidy", characters: "(squirrel)", fileName: "heidy", isDefault: false },
    { name: "Good luck", characters: "(goodluck)", fileName: "goodluck", isDefault: true },
    { name: "Umbrella", characters: "(umbrella)", fileName: "umbrella", isDefault: true },
    { name: "Plane", characters: "(airplane)", fileName: "plane", isDefault: false },
    { name: "Computer", characters: "(computer)", fileName: "computer", isDefault: true },
    { name: "Let's meet", characters: "(letsmeet)", fileName: "letsmeet", isDefault: true },
    { name: "It wasn't me!", characters: "(wasntme)", fileName: "wasntme", isDefault: false },
    { name: "Waiting", characters: "(waiting)", fileName: "waiting", isDefault: true },
    { name: "Waiting", characters: "(forever)", fileName: "waiting", isDefault: false },
    { name: "Fingers crossed", characters: "(fingers)", fileName: "fingerscrossed", isDefault: false },
    { name: "Giggle", characters: "(chuckle)", fileName: "giggle", isDefault: true },
    { name: "Bicycle", characters: "(bicycle)", fileName: "bike", isDefault: false },
    { name: "Rainbow", characters: "(rainbow)", fileName: "rainbow", isDefault: true },
    { name: "Wondering", characters: "(wonder)", fileName: "wonder", isDefault: false },
    { name: "Bartlett", characters: "(soccer)", fileName: "bartlett", isDefault: false },
    { name: "Sleepy", characters: "(snooze)", fileName: "sleepy", isDefault: false },
    { name: "In love", characters: "(inlove)", fileName: "inlove", isDefault: false },
    { name: "Make-up", characters: "(makeup)", fileName: "makeup", isDefault: true },
    { name: "Thinking", characters: "(think)", fileName: "think", isDefault: false },
    { name: "Giggle", characters: "(giggle)", fileName: "giggle", isDefault: false },
    { name: "High five", characters: "(hifive)", fileName: "highfive", isDefault: false },
    { name: "Lalala", characters: "(lalala)", fileName: "lalala", isDefault: true },
    { name: "Bandit", characters: "(bandit)", fileName: "bandit", isDefault: true },
    { name: "Muscle", characters: "(muscle)", fileName: "muscle", isDefault: false },
    { name: "Woman", characters: "(female)", fileName: "woman", isDefault: false },
    { name: "Bicycle", characters: "(sander)", fileName: "bike", isDefault: false },
    { name: "Flower", characters: "(flower)", fileName: "flower", isDefault: false },
    { name: "Island", characters: "(island)", fileName: "island", isDefault: true },
    { name: "Raining", characters: "(london)", fileName: "rain", isDefault: false },
    { name: "Coffee", characters: "(coffee)", fileName: "coffee", isDefault: true },
    { name: "Camera", characters: "(camera)", fileName: "camera", isDefault: true },
    { name: "Hold on", characters: "(holdon)", fileName: "holdon", isDefault: true },
    { name: "Smiley", characters: "(smile)", fileName: "smile", isDefault: false },
    { name: "Big smile", characters: "(laugh)", fileName: "laugh", isDefault: false },
    { name: "Sweating", characters: "(sweat)", fileName: "sweat", isDefault: false },
    { name: "Blushing", characters: "(blush)", fileName: "blush", isDefault: false },
    { name: "Angry", characters: "(angry)", fileName: "angry", isDefault: false },
    { name: "Party", characters: "(party)", fileName: "party", isDefault: false },
    { name: "Worried", characters: "(worry)", fileName: "worry", isDefault: false },
    { name: "Devil", characters: "(devil)", fileName: "devil", isDefault: true },
    { name: "Angel", characters: "(angel)", fileName: "angel", isDefault: true },
    { name: "Rolling on the floor laughing", characters: "(rotfl)", fileName: "rofl", isDefault: false },
    { name: "Happy", characters: "(happy)", fileName: "happy", isDefault: true },
    { name: "Smirking", characters: "(smirk)", fileName: "smirk", isDefault: false },
    { name: "Shake", characters: "(shake)", fileName: "shake", isDefault: true },
    { name: "Punch", characters: "(punch)", fileName: "punch", isDefault: false },
    { name: "Swearing", characters: "(swear)", fileName: "swear", isDefault: true },
    { name: "Woman", characters: "(woman)", fileName: "woman", isDefault: true },
    { name: "Dancing", characters: "(dance)", fileName: "dance", isDefault: true },
    { name: "Ninja", characters: "(ninja)", fileName: "ninja", isDefault: true },
    { name: "Heidy", characters: "(heidy)", fileName: "heidy", isDefault: true },
    { name: "Snail", characters: "(snail)", fileName: "snail", isDefault: true },
    { name: "Pizza", characters: "(pizza)", fileName: "pizza", isDefault: false },
    { name: "Drink", characters: "(drink)", fileName: "drink", isDefault: false },
    { name: "Plane", characters: "(plane)", fileName: "plane", isDefault: true },
    { name: "Games", characters: "(games)", fileName: "games", isDefault: true },
    { name: "Phone", characters: "(phone)", fileName: "phone", isDefault: false },
    { name: "Movie", characters: "(movie)", fileName: "movie", isDefault: false },
    { name: "Music", characters: "(music)", fileName: "music", isDefault: true },
    { name: "Time", characters: "(clock)", fileName: "time", isDefault: false },
    { name: "Cool", characters: "(cool)", fileName: "cool", isDefault: false },
    { name: "Winking", characters: "(wink)", fileName: "wink", isDefault: false },
    { name: "Kiss", characters: "(kiss)", fileName: "kiss", isDefault: true },
    { name: "In love", characters: "(love)", fileName: "inlove", isDefault: false },
    { name: "Evil", characters: "(grin)", fileName: "evilgrin", isDefault: true },
    { name: "Yawning", characters: "(yawn)", fileName: "yawn", isDefault: true },
    { name: "Puking", characters: "(puke)", fileName: "puke", isDefault: false },
    { name: "Mmmmm...", characters: "(mmmm)", fileName: "mmm", isDefault: false },
    { name: "Nerdy", characters: "(nerd)", fileName: "nerdy", isDefault: false },
    { name: "Envious", characters: "(envy)", fileName: "envy", isDefault: true },
    { name: "Make-up", characters: "(kate)", fileName: "makeup", isDefault: false },
    { name: "Rolling on the floor laughing", characters: "(rofl)", fileName: "rofl", isDefault: true },
    { name: "Wave", characters: "(wave)", fileName: "hi", isDefault: true },
    { name: "Facepalm", characters: "(fail)", fileName: "facepalm", isDefault: false },
    { name: "Wait", characters: "(wait)", fileName: "wait", isDefault: true },
    { name: "Clapping", characters: "(clap)", fileName: "clap", isDefault: true },
    { name: "Whew", characters: "(whew)", fileName: "whew", isDefault: true },
    { name: "Whew", characters: "(phew)", fileName: "whew", isDefault: false },
    { name: "Call", characters: "(call)", fileName: "call", isDefault: true },
    { name: "Idea", characters: "(idea)", fileName: "idea", isDefault: false },
    { name: "Rock", characters: "(rock)", fileName: "rock", isDefault: true },
    { name: "Talking", characters: "(talk)", fileName: "talk", isDefault: true },
    { name: "Muscle", characters: "(flex)", fileName: "muscle", isDefault: true },
    { name: "Man", characters: "(male)", fileName: "man", isDefault: false },
    { name: "Woman", characters: "(girl)", fileName: "woman", isDefault: false },
    { name: "Stop", characters: "(stop)", fileName: "stop", isDefault: true },
    { name: "Bicycle", characters: "(bike)", fileName: "bike", isDefault: true },
    { name: "Cat", characters: "(cat)", fileName: "cat", isDefault: true },
    { name: "Cat", characters: "(meow)", fileName: "cat", isDefault: false },
    { name: "Hug", characters: "(bear)", fileName: "hug", isDefault: false },
    { name: "Raining", characters: "(rain)", fileName: "rain", isDefault: true },
    { name: "Star", characters: "(star)", fileName: "star", isDefault: false },
    { name: "Cake", characters: "(cake)", fileName: "cake", isDefault: false },
    { name: "Beer", characters: "(beer)", fileName: "beer", isDefault: true },
    { name: "Gift", characters: "(gift)", fileName: "gift", isDefault: true },
    { name: "You have mail", characters: "(mail)", fileName: "mail", isDefault: false },
    { name: "Cash", characters: "(cash)", fileName: "cash", isDefault: true },
    { name: "Movie", characters: "(film)", fileName: "movie", isDefault: false },
    { name: "Time", characters: "(time)", fileName: "time", isDefault: false },
    { name: "Sad", characters: "(sad)", fileName: "sad", isDefault: false },
    { name: "Big smile", characters: "(lol)", fileName: "laugh", isDefault: false },
    { name: "Big smile", characters: "(LOL)", fileName: "laugh", isDefault: false },
    { name: "Doh!", characters: "(doh)", fileName: "doh", isDefault: true },
    { name: "Mmmmm...", characters: "(mmm)", fileName: "mmm", isDefault: false },
    { name: "Nod", characters: "(nod)", fileName: "nod", isDefault: true },
    { name: "Emo", characters: "(emo)", fileName: "emo", isDefault: true },
    { name: "Wave", characters: "(bye)", fileName: "hi", isDefault: false },
    { name: "Wave", characters: "(Bye)", fileName: "hi", isDefault: false },
    { name: "Wave", characters: "(BYE)", fileName: "hi", isDefault: false },
    { name: "Too much information", characters: "(tmi)", fileName: "tmi", isDefault: true },
    { name: "Yes", characters: "(yes)", fileName: "yes", isDefault: false },
    { name: "Yes", characters: "(YES)", fileName: "yes", isDefault: false },
    { name: "Man", characters: "(man)", fileName: "man", isDefault: true },
    { name: "Man", characters: "(boy)", fileName: "man", isDefault: false },
    { name: "Bowing", characters: "(bow)", fileName: "bow", isDefault: true },
    { name: "Dog", characters: "(dog)", fileName: "dog", isDefault: false },
    { name: "Hug", characters: "(hug)", fileName: "hug", isDefault: true },
    { name: "Sun", characters: "(sun)", fileName: "sun", isDefault: true },
    { name: "Car", characters: "(car)", fileName: "car", isDefault: true },
    { name: "Working from home", characters: "(wfh)", fileName: "wfh", isDefault: true },
    { name: "What's going on?", characters: "(!!?)", fileName: "whatsgoingon", isDefault: false },
    { name: "Puking", characters: ":-&&", fileName: "puke", isDefault: false },
    { name: "Puking", characters: ":=&&", fileName: "puke", isDefault: false },
    { name: "Umbrella", characters: "(um)", fileName: "umbrella", isDefault: false },
    { name: "Mmmmm...", characters: "(mm)", fileName: "mmm", isDefault: true },
    { name: "Fingers crossed", characters: "(yn)", fileName: "fingerscrossed", isDefault: true },
    { name: "Wave", characters: "(hi)", fileName: "hi", isDefault: false },
    { name: "Wave", characters: "(Hi)", fileName: "hi", isDefault: false },
    { name: "Wave", characters: "(HI)", fileName: "hi", isDefault: false },
    { name: "High five", characters: "(h5)", fileName: "highfive", isDefault: false },
    { name: "Idea", characters: "*-:)", fileName: "idea", isDefault: false },
    { name: "Yes", characters: "(ok)", fileName: "yes", isDefault: false },
    { name: "No", characters: "(no)", fileName: "no", isDefault: false },
    { name: "Bartlett", characters: "(so)", fileName: "bartlett", isDefault: false },
    { name: "Snail", characters: "(sn)", fileName: "snail", isDefault: false },
    { name: "Snail", characters: "(SN)", fileName: "snail", isDefault: false },
    { name: "Island", characters: "(ip)", fileName: "island", isDefault: false },
    { name: "Raining", characters: "(st)", fileName: "rain", isDefault: false },
    { name: "Pizza", characters: "(pi)", fileName: "pizza", isDefault: true },
    { name: "Computer", characters: "(co)", fileName: "computer", isDefault: false },
    { name: "Car", characters: "(au)", fileName: "car", isDefault: false },
    { name: "Plane", characters: "(ap)", fileName: "plane", isDefault: false },
    { name: "Working from home", characters: "(@h)", fileName: "wfh", isDefault: false },
    { name: "Working from home", characters: "(@H)", fileName: "wfh", isDefault: false },
    { name: "Phone", characters: "(mp)", fileName: "phone", isDefault: true },
    { name: "Phone", characters: "(ph)", fileName: "phone", isDefault: false },
    { name: "Cash", characters: "(mo)", fileName: "cash", isDefault: false },
    { name: "Smiley", characters: ":-)", fileName: "smile", isDefault: false },
    { name: "Smiley", characters: ":=)", fileName: "smile", isDefault: false },
    { name: "Sad", characters: ":-(", fileName: "sad", isDefault: false },
    { name: "Sad", characters: ":=(", fileName: "sad", isDefault: false },
    { name: "Sad", characters: ":-<", fileName: "sad", isDefault: false },
    { name: "Big smile", characters: ":-D", fileName: "laugh", isDefault: false },
    { name: "Big smile", characters: ":=D", fileName: "laugh", isDefault: false },
    { name: "Big smile", characters: ":-d", fileName: "laugh", isDefault: false },
    { name: "Big smile", characters: ":=d", fileName: "laugh", isDefault: false },
    { name: "Big smile", characters: ":->", fileName: "laugh", isDefault: false },
    { name: "Cool", characters: "B-)", fileName: "cool", isDefault: true },
    { name: "Cool", characters: "B=)", fileName: "cool", isDefault: false },
    { name: "Surprised", characters: ":-O", fileName: "surprised", isDefault: false },
    { name: "Surprised", characters: ":=O", fileName: "surprised", isDefault: false },
    { name: "Surprised", characters: ":-o", fileName: "surprised", isDefault: false },
    { name: "Surprised", characters: ":=o", fileName: "surprised", isDefault: false },
    { name: "Winking", characters: ";-)", fileName: "wink", isDefault: false },
    { name: "Winking", characters: ";=)", fileName: "wink", isDefault: false },
    { name: "Crying", characters: ":'(", fileName: "cry", isDefault: true },
    { name: "Crying", characters: ";-(", fileName: "cry", isDefault: false },
    { name: "Crying", characters: ";=(", fileName: "cry", isDefault: false },
    { name: "Sweating", characters: "(:|", fileName: "sweat", isDefault: true },
    { name: "Speechless", characters: ":-|", fileName: "speechless", isDefault: false },
    { name: "Speechless", characters: ":=|", fileName: "speechless", isDefault: false },
    { name: "Smiley with tongue out", characters: ":-P", fileName: "tongueout", isDefault: false },
    { name: "Smiley with tongue out", characters: ":=P", fileName: "tongueout", isDefault: false },
    { name: "Smiley with tongue out", characters: ":-p", fileName: "tongueout", isDefault: false },
    { name: "Smiley with tongue out", characters: ":=p", fileName: "tongueout", isDefault: false },
    { name: "Blushing", characters: ":-$", fileName: "blush", isDefault: false },
    { name: "Blushing", characters: ":=$", fileName: "blush", isDefault: false },
    { name: "Wondering", characters: ":^)", fileName: "wonder", isDefault: true },
    { name: "Sleepy", characters: "|-)", fileName: "sleepy", isDefault: true },
    { name: "Sleepy", characters: "I-)", fileName: "sleepy", isDefault: false },
    { name: "Dull", characters: "|-(", fileName: "dull", isDefault: true },
    { name: "Dull", characters: "|=(", fileName: "dull", isDefault: false },
    { name: "In love", characters: ":-]", fileName: "inlove", isDefault: false },
    { name: "Puking", characters: ":&&", fileName: "puke", isDefault: true },
    { name: "Puking", characters: "+o(", fileName: "puke", isDefault: false },
    { name: "Angry", characters: ":-@", fileName: "angry", isDefault: false },
    { name: "Angry", characters: ":=@", fileName: "angry", isDefault: false },
    { name: "Angry", characters: "x-(", fileName: "angry", isDefault: false },
    { name: "Angry", characters: "X-(", fileName: "angry", isDefault: false },
    { name: "Angry", characters: "x=(", fileName: "angry", isDefault: false },
    { name: "Angry", characters: "X=(", fileName: "angry", isDefault: false },
    { name: "Angry", characters: ";-@", fileName: "angry", isDefault: false },
    { name: "It wasn't me!", characters: "8-)", fileName: "wasntme", isDefault: true },
    { name: "It wasn't me!", characters: "8=)", fileName: "wasntme", isDefault: false },
    { name: "Party", characters: "<O)", fileName: "party", isDefault: true },
    { name: "Party", characters: "<o)", fileName: "party", isDefault: false },
    { name: "Worried", characters: ":-S", fileName: "worry", isDefault: false },
    { name: "Worried", characters: ":=S", fileName: "worry", isDefault: false },
    { name: "Worried", characters: ":-s", fileName: "worry", isDefault: false },
    { name: "Worried", characters: ":=s", fileName: "worry", isDefault: false },
    { name: "Nerdy", characters: "8-|", fileName: "nerdy", isDefault: true },
    { name: "Nerdy", characters: "B-|", fileName: "nerdy", isDefault: false },
    { name: "Nerdy", characters: "8=|", fileName: "nerdy", isDefault: false },
    { name: "Nerdy", characters: "B=|", fileName: "nerdy", isDefault: false },
    { name: "My lips are sealed", characters: ":-x", fileName: "lipssealed", isDefault: false },
    { name: "My lips are sealed", characters: ":-X", fileName: "lipssealed", isDefault: false },
    { name: "My lips are sealed", characters: ":-#", fileName: "lipssealed", isDefault: false },
    { name: "My lips are sealed", characters: ":=x", fileName: "lipssealed", isDefault: false },
    { name: "My lips are sealed", characters: ":=X", fileName: "lipssealed", isDefault: false },
    { name: "My lips are sealed", characters: ":=#", fileName: "lipssealed", isDefault: false },
    { name: "Thinking", characters: ":-?", fileName: "think", isDefault: true },
    { name: "Thinking", characters: ":=?", fileName: "think", isDefault: false },
    { name: "Thinking", characters: "*-)", fileName: "think", isDefault: false },
    { name: "Smirking", characters: "^o)", fileName: "smirk", isDefault: true },
    { name: "Punch", characters: "*-|", fileName: "punch", isDefault: false },
    { name: "Man", characters: "(Z)", fileName: "man", isDefault: false },
    { name: "Man", characters: "(z)", fileName: "man", isDefault: false },
    { name: "Woman", characters: "(X)", fileName: "woman", isDefault: false },
    { name: "Woman", characters: "(x)", fileName: "woman", isDefault: false },
    { name: "Call", characters: "(T)", fileName: "call", isDefault: false },
    { name: "Call", characters: "(t)", fileName: "call", isDefault: false },
    { name: "Heart", characters: "(l)", fileName: "heart", isDefault: false },
    { name: "Heart", characters: "(L)", fileName: "heart", isDefault: false },
    { name: "Broken heart", characters: "(u)", fileName: "brokenheart", isDefault: true },
    { name: "Broken heart", characters: "(U)", fileName: "brokenheart", isDefault: false },
    { name: "Yes", characters: "(y)", fileName: "yes", isDefault: true },
    { name: "Yes", characters: "(Y)", fileName: "yes", isDefault: false },
    { name: "Camera", characters: "(P)", fileName: "camera", isDefault: false },
    { name: "Camera", characters: "(p)", fileName: "camera", isDefault: false },
    { name: "No", characters: "(n)", fileName: "no", isDefault: true },
    { name: "No", characters: "(N)", fileName: "no", isDefault: false },
    { name: "Kiss", characters: "(k)", fileName: "kiss", isDefault: false },
    { name: "Kiss", characters: "(K)", fileName: "kiss", isDefault: false },
    { name: "Cat", characters: "(@)", fileName: "cat", isDefault: false },
    { name: "Dog", characters: ":o3", fileName: "dog", isDefault: true },
    { name: "Idea", characters: "(I)", fileName: "idea", isDefault: false },
    { name: "Idea", characters: "(i)", fileName: "idea", isDefault: false },
    { name: "Gift", characters: "(G)", fileName: "gift", isDefault: false },
    { name: "Gift", characters: "(g)", fileName: "gift", isDefault: false },
    { name: "Flower", characters: "(F)", fileName: "flower", isDefault: true },
    { name: "Flower", characters: "(f)", fileName: "flower", isDefault: false },
    { name: "Coffee", characters: "(C)", fileName: "coffee", isDefault: false },
    { name: "Coffee", characters: "(c)", fileName: "coffee", isDefault: false },
    { name: "Beer", characters: "(B)", fileName: "beer", isDefault: false },
    { name: "Beer", characters: "(b)", fileName: "beer", isDefault: false },
    { name: "Music", characters: "(8)", fileName: "music", isDefault: false },
    { name: "Sun", characters: "(#)", fileName: "sun", isDefault: false },
    { name: "Star", characters: "(*)", fileName: "star", isDefault: true },
    { name: "Cake", characters: "(^)", fileName: "cake", isDefault: true },
    { name: "Hug", characters: "({)", fileName: "hug", isDefault: false },
    { name: "Hug", characters: "(})", fileName: "hug", isDefault: false },
    { name: "Drink", characters: "(d)", fileName: "drink", isDefault: true },
    { name: "Drink", characters: "(D)", fileName: "drink", isDefault: false },
    { name: "You have mail", characters: "(e)", fileName: "mail", isDefault: true },
    { name: "You have mail", characters: "(E)", fileName: "mail", isDefault: false },
    { name: "You have mail", characters: "(m)", fileName: "mail", isDefault: false },
    { name: "Cash", characters: "($)", fileName: "cash", isDefault: false },
    { name: "Movie", characters: "(~)", fileName: "movie", isDefault: true },
    { name: "Time", characters: "(o)", fileName: "time", isDefault: true },
    { name: "Time", characters: "(O)", fileName: "time", isDefault: false },
    { name: "Smiley", characters: ":)", fileName: "smile", isDefault: true },
    { name: "Sad", characters: ":(", fileName: "sad", isDefault: true },
    { name: "Sad", characters: ":<", fileName: "sad", isDefault: false },
    { name: "Big smile", characters: ":D", fileName: "laugh", isDefault: true },
    { name: "Big smile", characters: ":d", fileName: "laugh", isDefault: false },
    { name: "Big smile", characters: ":>", fileName: "laugh", isDefault: false },
    { name: "Surprised", characters: ":O", fileName: "surprised", isDefault: true },
    { name: "Surprised", characters: ":o", fileName: "surprised", isDefault: false },
    { name: "Winking", characters: ";)", fileName: "wink", isDefault: true },
    { name: "Crying", characters: ";(", fileName: "cry", isDefault: false },
    { name: "Speechless", characters: ":|", fileName: "speechless", isDefault: true },
    { name: "Smiley with tongue out", characters: ":P", fileName: "tongueout", isDefault: true },
    { name: "Smiley with tongue out", characters: ":p", fileName: "tongueout", isDefault: false },
    { name: "Blushing", characters: ":$", fileName: "blush", isDefault: true },
    { name: "Dull", characters: "|(", fileName: "dull", isDefault: false },
    { name: "In love", characters: ":]", fileName: "inlove", isDefault: true },
    { name: "Angry", characters: ":@", fileName: "angry", isDefault: true },
    { name: "Angry", characters: "x(", fileName: "angry", isDefault: false },
    { name: "Angry", characters: "X(", fileName: "angry", isDefault: false },
    { name: "Angry", characters: ";@", fileName: "angry", isDefault: false },
    { name: "Worried", characters: ":S", fileName: "worry", isDefault: true },
    { name: "Worried", characters: ":s", fileName: "worry", isDefault: false },
    { name: "Nerdy", characters: "8|", fileName: "nerdy", isDefault: false },
    { name: "Nerdy", characters: "B|", fileName: "nerdy", isDefault: false },
    { name: "My lips are sealed", characters: ":x", fileName: "lipssealed", isDefault: true },
    { name: "My lips are sealed", characters: ":X", fileName: "lipssealed", isDefault: false },
    { name: "My lips are sealed", characters: ":#", fileName: "lipssealed", isDefault: false },
    { name: "Thinking", characters: ":?", fileName: "think", isDefault: false },
    { name: "Idea", characters: ":i", fileName: "idea", isDefault: true },
    { name: "Idea", characters: ":I", fileName: "idea", isDefault: false },
    { name: "Punch", characters: "*|", fileName: "punch", isDefault: true },
    { name: "Heart", characters: "<3", fileName: "heart", isDefault: true}
]
```

</div>