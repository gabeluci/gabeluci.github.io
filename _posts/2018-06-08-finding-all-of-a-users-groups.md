---
layout: default
title: "Finding all of a user's groups"
category: "Active Directory"
permalink: /active-directory/:year/:month/:day/:title:output_ext
comments: true
---

# {{page.category}}: {{page.title}}

In this article, I'll go over how to find all of the groups that a user is a member of. While the code is in C#, the principals can be applied to any language that can make LDAP queries.

It's first important to understand how a user even becomes a member of a group - it's not as straight-forward as you may think. So if you haven't already, read that article first:

> [What makes a member a member?]({% post_url 2018-06-07-what-makes-a-member %})

## Why am I doing this?

The reason why you want to know all of the user's groups may change your approach. For example, if you need to know for the purposes of **granting permissions**, then you need to gather the groups recursively. That is, if a permission is granted to `GroupA`, and `GroupB` is a member of `GroupA`, and a user is a member of `GroupB`, then that user should be granted the permissions granted to `GroupA`.

A recursive search for every group is time consuming. If you already know the name of the group(s) you're looking for, then you are better off narrowing your search to just that group. I go into that in another article:

> [Find out if one user is a member of a group]({% post_url 2018-09-13-one-user-is-member-of-a-group %})

## The code

### `System.DirectoryServices.AccountManagement`

The `AccountManagement` namespace makes this easy for us. When you're using Windows Authentication, or just running a desktop app in Windows, you will have access to a `UserPrincipal` object of the current user. So let's say we already have a `UserPrincipal` object called `user` for the user in question. If we want to get just the user's immediate groups, we can do this:

```c#
using (var groups = user.GetGroups()) {
    //do something
}
```

The [`GetGroups()`](https://docs.microsoft.com/en-ca/dotnet/api/system.directoryservices.accountmanagement.principal.getgroups) method uses the `memberOf` attribute, so **it has the limitations stated in [my other article]({% post_url 2018-09-13-one-user-is-member-of-a-group %})**. However, it also does a seperate lookup for the user's primary group, which you may or may not care about.

There is also a separate method for authorization groups:

```c#
using (var authorizationGroups = user.GetAuthorizationGroups()) {
    //do something
}
```

The [`GetAuthorizationGroups()`](https://docs.microsoft.com/en-ca/dotnet/api/system.directoryservices.accountmanagement.userprincipal.getauthorizationgroups) method will give you **only Security Groups** (not Distribution Lists) that the user is a member of, as well as all the groups those groups are in, etc. It will include Domain Local groups on the same domain as the user.

If you're curious, this method works in one of two ways:

1. If the computer you run the method from is joined to a domain that is fully trusted by the domain the user account is on, then it uses the native Windows [Authz API](https://msdn.microsoft.com/en-us/library/windows/desktop/ff394773%28v=vs.85%29.aspx).
2. Otherwise, it reads the [`tokenGroups`](https://msdn.microsoft.com/en-us/library/ms680275(v=vs.85).aspx) attribute on the AD object, which is a constructed attribute that lists the SIDs of authorization groups for the user.

> Constructed attributes - like [`tokenGroups`](https://msdn.microsoft.com/en-us/library/ms680275(v=vs.85).aspx), [`canonicalName`](https://msdn.microsoft.com/en-us/library/ms675436%28v=vs.85%29.aspx), [`msDS-PrincipalName`](https://msdn.microsoft.com/en-us/library/ms677470(v=vs.85).aspx) and others - are not stored. These attributes are only given to you when you ask, and their values are calculated at the time you ask for them. For this reason, you cannot use these attributes in a query.

Note that I have seen `GetAuthorizationGroups()` return `Everyone`, but not all the time. I believe this only happens when the Authz method is used, and only when the computer you run it from is on the same domain as the user, but I haven't been able to confirm this yet.

> Both of these methods return [`PrincipalSearchResult`](https://docs.microsoft.com/en-ca/dotnet/api/system.directoryservices.accountmanagement.principalsearchresult-1) objects, which implements `IDisposible`. Thus, they should be used in `using` statements, or you should call `.Dispose()` on the result when you're done with it.

### `System.DirectoryServices`

If you're willing to do a little extra work, you can get much better performance by using `DirectoryEntry` and `DirectorySearcher` directly (the `AccountManagement` namespace uses those in the background anyway).

None of these examples will likely be exactly what you need. You may be starting with different information about the user account (maybe just a `distinguishedName` or the `sAMAccountName`), or you may need to come away with different values. Modify these examples as needed. You may even want to combine several of these examples together.

For simplicity, these examples assume you already have a `DirectoryEntry` object for the user in question.

#### Using `memberOf`

Here is a method that will use the `memberOf` attribute and return the name of each group.

```c#
private static IEnumerable<string> GetUserMemberOf(DirectoryEntry de) {
    var groups = new List<string>();

    //retrieve only the memberOf attribute from the user
    de.RefreshCache(new[] {"memberOf"});

    while (true) {
        var memberOf = de.Properties["memberOf"];
        foreach (string group in memberOf) {
            var groupDe = new DirectoryEntry($"LDAP://{group.Replace("/", "\\/")}");
            groupDe.RefreshCache(new[] {"cn"});
            groups.Add(groupDe.Properties["cn"].Value as string);
        }

        //AD only gives us 1000 or 1500 at a time (depending on the server version)
        //so if we've hit that, go see if there are more
        if (memberOf.Count != 1500 && memberOf.Count != 1000) break;

        try {
            de.RefreshCache(new[] {$"memberOf;range={groups.Count}-*"});
        } catch (COMException e) {
            if (e.ErrorCode == unchecked((int) 0x80072020)) break; //no more results

            throw;
        }
    }
    return groups;
}
```

#### The primary group

This method will return the name of a user's primary group.

```c#
private static string GetUserPrimaryGroup(DirectoryEntry de) {
    de.RefreshCache(new[] {"primaryGroupID", "objectSid"});

    //Get the user's SID as a string
    var sid = new SecurityIdentifier((byte[])de.Properties["objectSid"].Value, 0).ToString();

    //Replace the RID portion of the user's SID with the primaryGroupId
    //so we're left with the group's SID
    sid = sid.Remove(sid.LastIndexOf("-", StringComparison.Ordinal) + 1);
    sid = sid + de.Properties["primaryGroupId"].Value;

    //Find the group by its SID
    var group = new DirectoryEntry($"LDAP://<SID={sid}>");
    group.RefreshCache(new [] {"cn"});

    return group.Properties["cn"].Value as string;
}
```

#### Everything everything

None of the methods we've described so far will find **Domain Local groups** on other domains, or **any groups on external trusted domains**. To find those, you need to perform the search on each domain individually. The method below does that. It will find every group that `memberOf` will find, plus more.

Since some of these are groups on other domains, this method will return a list of the `msDS-PrincipalName` attribute of the groups, which is the `DOMAIN\sAMAccountName` format.

Notice that there are two parts to this method:

1. Searching each domain in the forest: the user's `distinguishedName` will appear in the `member` attribute of the groups.
2. Searching external trusted domains: the `distinguishedName` of a Foreign Security Principal object containing the user's SID will appear in the `member` attribute of the groups.

Note that you will need to run this with credentials that are trusted on every domain that this touches, otherwise it will throw exceptions.

```c#
private static IEnumerable<string> GetUsersGroupsAllDomains(DirectoryEntry de) {
    var groups = new List<string>();

    de.RefreshCache(new [] {"canonicalName", "objectSid", "distinguishedName"});

    var userCn = (string) de.Properties["canonicalName"].Value;
    var domainDns = userCn.Substring(0, userCn.IndexOf("/", StringComparison.Ordinal));

    var d = Domain.GetDomain(new DirectoryContext(DirectoryContextType.Domain, domainDns));
    var searchedDomains = new List<string>();

    //search domains in the same forest (this will include the user's domain)
    var userDn = (string) de.Properties["distinguishedName"].Value;
    foreach (Domain domain in d.Forest.Domains) {
        searchedDomains.Add(domain.Name);
        var ds = new DirectorySearcher {
            SearchRoot = new DirectoryEntry($"LDAP://{domain.Name}"),
            Filter = $"(&(objectclass=group)(member={userDn}))"
        };
        ds.PropertiesToLoad.Add("msDS-PrincipalName");
        using (var results = ds.FindAll()) {
            foreach (SearchResult result in results) {
                groups.Add((string) result.Properties["msDS-PrincipalName"][0]);
            }
        }
    }

    //search any externally trusted domains
    var trusts = d.GetAllTrustRelationships();
    if (trusts.Count == 0) return groups;

    var userSid = new SecurityIdentifier((byte[]) de.Properties["objectSid"].Value, 0).ToString();
    foreach (TrustRelationshipInformation trust in trusts) {
        //ignore domains in the same forest that we already searched, or outbound trusts
        if (searchedDomains.Contains(trust.TargetName)
            || trust.TrustDirection == TrustDirection.Outbound) continue;
        var domain = new DirectoryEntry($"LDAP://{trust.TargetName}");
        domain.RefreshCache(new [] {"distinguishedName"});
        var domainDn = (string) domain.Properties["distinguishedName"].Value;

        //construct the DN of what the foreign security principal object would be
        var fsp = $"CN={userSid},CN=ForeignSecurityPrincipals,{domainDn}";

        var ds = new DirectorySearcher {
            SearchRoot = domain,
            Filter = $"(&(objectclass=group)(member={fsp}))"
        };
        ds.PropertiesToLoad.Add("msDS-PrincipalName");
        using (var results = ds.FindAll()) {
            foreach (SearchResult result in results) {
                groups.Add((string) result.Properties["msDS-PrincipalName"][0]);
            }
        }
    }

    return groups;
}
```

The code that looks for the domains (like `Domain.GetDomain()`, `d.Forest.Domains`, and `d.GetAllTrustRelationships()`) make calls out to AD to find that information. To gain performance, you can either hard-code the domain names in (if your code will only be run in one AD environment) or cache them the first time you find them.