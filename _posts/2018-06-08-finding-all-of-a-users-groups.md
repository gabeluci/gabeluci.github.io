---
layout: default
title: "Finding all of a user's groups"
category: "Active Directory"
published: false
---

# {{page.category}}: {{page.title}}

In this article, I'll go over how to find all of the groups that a user is a member of in .NET - specifically, C#. It's first important to understand how a user even becomes a member of a group - it's not as straight-forward as you may think. So if you haven't already, read that article first:

> [What makes a member a member?]({% post_url 2018-06-07-what-makes-a-member %})

## Beware of `memberOf`

You may be tempted to just use the `memberOf` attribute of the user. That's what it's for, right? It has all the groups the user is a member of...

Well, maybe. Groups only get added to `memberOf` if they have a Group Scope of:

1. Universal and are in the same AD forest as the user, or
2. Global and are on the same domain.

Groups _do not_ get added to `memberOf` if they have a Group Scope of Global and are on another domain (even if in the same forest). The `memberOf` attribute will report Domain Local groups on the same domain as the user, but only if you retrieve the results from a domain controller or global catalog on the same domain.

It will also not report the user's primary group (usually `Domain Users`), if that's important to you.

Does this mean you can never rely on `memberOf`? No. It's perfectly appropriate if:

1. You're working in a single-domain environment, or
2. You are sure you only care about Universal groups (such as distribution lists)

If `memberOf` is good enough for you, then use it! It will be the quickest way.

The next important question is:

## Why?

The reason why you want to know all of the user's groups may change your approach. For example, if you need to know for the purposes of **granting permissions**, then you need to gather the groups recursively. That is, if a permission is granted to `GroupA`, and `GroupB` is a member of `GroupA`, and a user is a member of `GroupB`, then that user should be granted the permissions granted to `GroupA`.

A recursive search for every group is time consuming. If you already know the name of the group(s) you're looking for, then you are better off narrowing your search to just that group. I go into that in another article:

> [Find out if one user is a member of one group]()

## AccountManagement namespace

The `System.DirectoryServices.AccountManagement` namespace makes this easy for us. Let's say we already have a `UserPrincipal` object called `user` for the user object in question. We can just do this:

    var authorizationGroups = user.GetAuthorizationGroups();
    //or
    var groups = user.GetGroups();

The `GetAuthorizationGroups()` method does a recursive search for only security groups, whereas `GetGroups()` only gets the security or distribution groups that the user is an immediate member of.

That was easy, right? But there's a catch. There is a performance cost to this that you may be able to avoid. These methods do a few things:

1. 