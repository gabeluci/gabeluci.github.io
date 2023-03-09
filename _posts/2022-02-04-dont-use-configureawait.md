---
layout: default
title: "Don't use ConfigureAwait(false)"
category: ".NET"
permalink: /dotnet/:year/:month/:day/:title:output_ext
comments: true
---

# {{page.category}}: {{page.title}}

Except for library code. I'll get to that, but hear me out.

I've seen this advice all over:

> As a general rule, `ConfigureAwait(false)` should be used for every await unless the method needs its context.

It's even what Stephen Cleary (a Microsoft MVP) says in his [Async and Await](https://blog.stephencleary.com/2012/02/async-and-await.html#avoiding-context) article:

> A good rule of thumb is to use ConfigureAwait(false) unless you know you do need the context.

Stephen definitely knows his stuff, and I agree that the advice is technically accurate, but I've always thought that this is bad advice for two reasons:

1. Beginners, and
2. Maintenance risk

## Beginnners

First, it's bad advice for beginners because synchronization context is a complex subject. If you start learning `async`/`await` by being told that "`ConfigureAwait(false)` should be used for every `await` unless the method needs its context", but you don't even know what "context" is and what it means to "need it", then **you don't know when you *shouldn't* use it, so you end up *always* using it**. That means you can run into bugs that will be very difficult to figure out unless you happen to learn that, yes, you did actually need that "context" thing and this magical "ConfigureAwait" thing made you lose it. You can lose hours trying to figure that out.

For applications of any kind, I believe **the advice really should be the opposite: Don't use `ConfigureAwait(false)` at all**, unless you know what it does and you have determined that you absolutely don't need the context after that line. However...

## Maintenance Risk

Determining you don't need the context can be either simple, or quite complex depending on what methods are called after. But even then - and this is the second reason I disagree with that advice - **just because you don't need the context after that line *right now*, doesn't mean some code won't be added later that will use the context**. You'll have to hope that whoever makes that change knows what `ConfigureAwait(false)` does, sees it, and removes it. Using `ConfigureAwait(false)` everywhere creates a maintenance risk.

## A Note on Synchronization Context

A couple simple examples of needing the synchronization context are:

1. Changing a UI control in a Windows Forms or WPF project
2. Accessing `HttpContext.Current` in an ASP.NET (not Core) project

Doing one of those things after the use of `await` with `ConfigureAwait(false)` *might* throw an exception. In the case of a Windows Forms or WPF app, a UI control can only be changed by the thread that created it. The synchronization context ensures that the continuation runs of the same thread. However, if you use `ConfigureAwait(false)`, you tell it that you don't care where it resumes, so it *might* resume on the same thread, or might not. **Using `ConfigureAwait(false)` leaves it up to chance whether an exception is thrown, making your debugging more difficult.**

If you'd like to read more about synchronization context, you can read the article [What is Synchronization Context?](https://hamidmosalla.com/2018/06/24/what-is-synchronizationcontext/) by Hamid Mosalla. If you'd like to dig even deeper and see some of the code that goes behind a synchronization context, you can read the article [Exploring the async/await State Machine – Synchronization Context](https://vkontech.com/exploring-the-async-await-state-machine-synchronization-context/) by Vasil Kosturski.

## Conclusion

This is what another Stephen, Stephen Toub (a Microsoft employee), recommends in the [ConfigureAwait FAQ](https://devblogs.microsoft.com/dotnet/configureawait-faq/) under the subheading "When should I use ConfigureAwait(false)?":

>When writing applications, you generally want the default behavior (which is why it is the default behavior). ... This leads to the general guidance of: **if you're writing app-level code, do not use `ConfigureAwait(false)`**

In my own application code, I don't bother trying to figure out where I can and can't use it. **I just ignore that `ConfigureAwait` exists.** Sure, there *can* be a performance improvement by using it where you can, but I really doubt that it will be a noticeable difference to any human, even if it is measurable by a timer. I don't believe the return on investment is positive.

## Libraries

The only exception to this is when you're writing libraries (code compiled into a DLL that will be used in other applications), as Stephen Toub points out in his article:

> **if you're writing general-purpose library code, use `ConfigureAwait(false)`**

That's for two reasons:

1. A library has no idea about the context of the application it's being used in, so it can't use the context anyway, and
2. If the person using the library decides to wait synchronously on your asynchronous library code, it could cause a deadlock that they cannot change because they can't change your code. (ideally, they shouldn't do that, but it can happen)

And keep in mind that it's not always enough to use `ConfigureAwait(false)` on the first `await` and not the rest. **Use it on *every* `await` in your library code.** Stephen Toub's article under the heading "Is it ok to use ConfigureAwait(false) only on the first await in my method and not on the rest?" says, in part:

>  If the `await task.ConfigureAwait(false)` involves a task that's already completed by the time it's awaited (which is actually incredibly common), then the `ConfigureAwait(false)` will be meaningless, as the thread continues to execute code in the method after this and still in the same context that was there previously.

It may seem arrogant of me to disagree with Stephen Cleary on this subject: he's well respected. However, I first wrote this as an [answer on Stack Overflow](https://stackoverflow.com/a/62505101/1202807). Stephen Cleary commented on that post saying:

> I believe I will update that `async` blog post. For the last several years, I have also recommended only using `ConfigureAwait(false)` for library code.

So it's good to know we agree on that now.