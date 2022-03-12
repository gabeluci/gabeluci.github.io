---
layout: default
title: "What makes a member a member?"
category: "Active Directory"
permalink: /active-directory/:year/:month/:day/:title:output_ext
comments: true
---

# {{page.category}}: {{page.title}}

This is the first article in a series about programming with Active Directory.

Some of the most common tasks is determining:

1. **All the groups** a user is a member of, or
2. **All the users** that are a member of a group, or
3. If one **specific user** is a member of one **specific group**

I'll go into how to handle those tasks in other articles, but it's important first to understand just how a user comes to be considered a member of a group.

It turns out that there are 3 ways:

## The `member` attribute

This is the most obvious and **99% of the time the only one** you will need to care about.

The `distinguishedName` of an object is added to the `member` attribute of a group. That object (whatever kind it may be) is now a member of that group. Makes sense?

But wait, there's more.

## The primary group

This one is easy to forget (or never learn), but fortunately it will likely rarely matter to you. Every user object must have a Primary Group, which is indicated by the `primaryGroupId` attribute on the user object. That attribute is set to **the `primaryGroupToken` attribute of a group on the same domain**. That makes the user a member of that group.

> The `primaryGroupToken` attribute of a group is equivalent to the group's Relative Identifier (RID), which is the portion of the Security Identifier (SID) that comes after the domain portion of the SID. When reading a SID string, the RID is the numbers after the last hyphen.

In most cases, the `primaryGroupId` will be `513`, which is always the RID for the `Domain Users` group. However the `primaryGroupId` can be changed.

You may or may not care what a user's primary group is. **You probably won't care** unless maybe you're working in a domain where the primary group is changed as a matter of practice.

## The foreigner

If you are working with a **domain that trusts other domains** outside of the same AD forest, then this one can be very important to you.

A group can have members from external, trusted domains. This is done by updating the `member` attribute of the group, but _not_ with the `distinguishedName` of the user.

When a user from an external domain is added to a group, a Foreign Security Principal (FSP) object is created. Every domain has a `ForeignSecurityPrincipals` container at the root of the domain, and that's where these are stored.

> Fun fact: a "container" is different from an "organizational unit" (OU). One has an `objectClass` of `container`, the other, `organizationalUnit`. They function much the same: you can put all the same objects inside. The only difference is that group policies can only be applied to OUs.

That FSP is **named after the SID of the user** on the external domain. The `distinguishedName` of the FSP object is then be added to the `member` attribute of the group, which makes the external user a member of that group.

This can only be done with groups with a scope of Domain Local.

## Beware of `memberOf`

When checking group membership, you may be tempted to just use the `memberOf` attribute of the user. That's what it's for, right? It has all the groups the user is a member of...

Well, maybe. Groups only get added to `memberOf` if they have a Group Scope of:

1. **Universal** and are in the same AD forest as the user, or
2. **Global** and are on the same domain.

Groups _do not_ get added to `memberOf` if they have a Group Scope of **Global and are on another domain** (even if in the same forest).

On top of that, `memberOf` will only include **Domain Local groups from the same domain of the server** you are retrieving results from. (if you are working in a multi-domain environment and reading from a Global Catalog, this may not be the same domain the user is from)

It will also not report the user's **primary group** (usually `Domain Users`), if that's important to you, nor will it include **groups on external trusted domains**.

Does this mean you can *never* rely on `memberOf`? No. It's perfectly appropriate if:

1. You're working in a **single-domain** environment, or
2. You're working in a **single-forest** environment and you are sure you only care about Universal groups (such as distribution lists)

If `memberOf` is good enough for you, then use it! It will be the quickest way.

The next important question is:

## Why do I care?

This knowledge is valuable **for performance** in your code. If you can make assumptions about the groups and users you are working with, then you may be able to ignore Primary Groups or Foreign Security Principals, and thus save time.

For exmaple,

- **Are you only working with groups that you know are never anyone's Primary Group?** Don't bother with the `primaryGroupId`.
- **Are you working in a single-domain environment that trusts no one?** Don't worry about Foreign Security Principals.

My other articles in this series will cover how you can do this.