---
layout: default
title: "Finding all of a user's groups"
category: "Active Directory"
permalink: /active-directory/:year/:month/:day/:title:output_ext
---

# {{page.category}}: {{page.title}}

> If you just want to see the code, scroll down to the bottom (if it's not there yet, it's coming).

In this article, I'll go over how to find all of the groups that a user is a member of in .NET - specifically, C#. It's first important to understand how a user even becomes a member of a group - it's not as straight-forward as you may think. So if you haven't already, read that article first:

> [What makes a member a member?]({% post_url 2018-06-07-what-makes-a-member %})

## Beware of `memberOf`

You may be tempted to just use the `memberOf` attribute of the user. That's what it's for, right? It has all the groups the user is a member of...

Well, maybe. Groups only get added to `memberOf` if they have a Group Scope of:

1. Universal and are in the same AD forest as the user, or
2. Global and are on the same domain.

Groups _do not_ get added to `memberOf` if they have a Group Scope of Global and are on another domain (even if in the same forest).

On top of that, `memberOf` will only include Domain Local groups from the domain of the domain controller or global catalog you are retrieving results from.

It will also not report the user's primary group (usually `Domain Users`), if that's important to you, nor will it include groups on external trusted domains.

Does this mean you can _never_ rely on `memberOf`? No. It's perfectly appropriate if:

1. You're working in a single-domain environment, or
2. You're working in a single-forest environment and you are sure you only care about Universal groups (such as distribution lists)

If `memberOf` is good enough for you, then use it! It will be the quickest way.

The next important question is:

## Why?

The reason why you want to know all of the user's groups may change your approach. For example, if you need to know for the purposes of **granting permissions**, then you need to gather the groups recursively. That is, if a permission is granted to `GroupA`, and `GroupB` is a member of `GroupA`, and a user is a member of `GroupB`, then that user should be granted the permissions granted to `GroupA`.

A recursive search for every group is time consuming. If you already know the name of the group(s) you're looking for, then you are better off narrowing your search to just that group. I go into that in another article:

> [Find out if one user is a member of one group]()

## The code

### `AccountManagement` namespace

The `System.DirectoryServices.AccountManagement` namespace makes this easy for us. Let's say we already have a `UserPrincipal` object called `user` for the user object in question. If we want to get just the user's immediate groups, we can just do this:

    var groups = user.GetGroups();

The `GetGroups()` method uses the `memberOf` attribute, so it has the limitations stated above. However, it also does a seperate lookup for the user's primary group, which you may or may not care about.

There is also a separate method for authentication groups:

    var authorizationGroups = user.GetAuthorizationGroups();


