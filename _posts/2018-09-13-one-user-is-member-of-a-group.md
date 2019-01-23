---
layout: default
title: "Find out if one user is a member of a group"
category: "Active Directory"
permalink: /active-directory/:year/:month/:day/:title:output_ext
comments: true
---

# {{page.category}}: {{page.title}}

This article will discuss figuring out if a specific user is a member of a specific group. That is, if you already know who the user is and what the group is. But before learning that, it's helpful to know just what makes a user a member of a group. If you haven't read that article yet, do that first:

> [What makes a member a member?]({% post_url 2018-06-07-what-makes-a-member %})

## The easy way

Whatever type of code you're writing, if you're using Windows Authentication, there will usually be a way to get **an object for the currently-authenticated user**. For example, in an ASP.NET application that is using Windows Authentication, you can use this to determine if the currently-authenticated user is a member of a group:

```c#
var isMember = HttpContext.Current.User.IsInRole("DOMAIN\\GroupName");
```

Or in a desktop application, you can use this:

```c#
var principal = new WindowsPrincipal(WindowsIdentity.GetCurrent());
var isMember = principal.IsInRole("DOMAIN\\GroupName");
```

Even if you're not using .NET, there will usually be some equivalent.

.NET's [`WindowsPrincipal.IsInRole`](https://docs.microsoft.com/en-us/dotnet/api/system.security.principal.windowsprincipal.isinrole) is designed for **testing authorization**: whether a person should be granted permissions that are granted to the group. Thus, it does work for nested membership (if the account is a member of a group that is a member of the group in question). It is fairly quick too, since it uses the account's authentication token to test the membership, which is already in memory. If you're curious, under the hood it uses Windows' built-in function called [`CheckTokenMembership`](https://docs.microsoft.com/en-us/windows/desktop/api/securitybaseapi/nf-securitybaseapi-checktokenmembership).

**The caveat** is that `IsInRole` (or any method designed for authentication) will not work for groups that are:

 - Distribution Lists (as opposed to Security Groups)
 - On an external trusted domain

## The slightly harder but still easy way

While the following code is in C#, the principals used can usually be adapted to any language that can query LDAP. This method will work regardless of:
 
 - **Group Type** (Distribution List or Security Group)
 - **Group Scope** (Universal, Global or Domain Local)
 - Whether the group and user are on the **same domain** or not
 - Whether the user is on an external **trusted domain** or not

```c#
private static bool IsUserInGroup(DirectoryEntry user, DirectoryEntry group, bool recursive) {

    //fetch the attributes we're going to need
    user.RefreshCache(new [] {"distinguishedName", "objectSid"});
    group.RefreshCache(new [] {"distinguishedName", "groupType"});

    //This magic number tells AD to look for the user recursively through any nested groups
    var recursiveFilter = recursive ? ":1.2.840.113556.1.4.1941:" : "";

    var userDn = (string) user.Properties["distinguishedName"].Value;
    var groupDn = (string) group.Properties["distinguishedName"].Value;
    
    var filter = $"(member{recursiveFilter}={userDn})";

    if (((int) group.Properties["groupType"].Value & 8) == 0) {
        var groupDomainDn = groupDn.Substring(
            groupDn.IndexOf(",DC=", StringComparison.Ordinal));
        var userDomainDn = userDn.Substring(
            userDn.IndexOf(",DC=", StringComparison.Ordinal));
        if (groupDomainDn != userDomainDn) {
            //It's a Domain Local group, and the user and group are on
            //different domains, so the account might show up as a Foreign
            //Security Principal. So construct a list of SID's that could
            //appear in the group for this user
            var fspFilters = new StringBuilder();
            
            var userSid =
                new SecurityIdentifier((byte[]) user.Properties["objectSid"].Value, 0);
            fspFilters.Append(
                $"(member{recursiveFilter}=CN={userSid},CN=ForeignSecurityPrincipals{groupDomainDn})");
            
            //Any of the groups the user is in could show up as an FSP,
            //so we need to check for them all
            user.RefreshCache(new [] {"tokenGroups"});
            var tokenGroups = user.Properties["tokenGroups"];
            foreach (byte[] token in tokenGroups) {
                var groupSid = new SecurityIdentifier(token, 0);
                fspFilters.Append(
                    $"(member{recursiveFilter}=CN={groupSid},CN=ForeignSecurityPrincipals{groupDomainDn})");
            }
            filter = $"(|{filter}{fspFilters})";
        }
    }

    var searcher = new DirectorySearcher {
        Filter = filter,
        SearchRoot = group,
        PageSize = 1, //we're only looking for one object
        SearchScope = SearchScope.Base
    };

    searcher.PropertiesToLoad.Add("cn"); //just so it doesn't load every property

    return searcher.FindOne() != null;
}
```

This method works by searching for groups that have the user as a member. But since we set **`SearchRoot` to the group itself**, it is only possible for that one group to be returned. So the search has two possible outcomes:

 1. If the user is a member, the group is returned
 2. Otherwise, nothing is returned

Hence, we only need to test if *something* was returned.

The `recursive` option works by using one of a few magic numbers called **Matching Rule OIDs**. This specific one (`1.2.840.113556.1.4.1941`) is called `LDAP_MATCHING_RULE_IN_CHAIN`. It can only be used on attributes that accept distinguished names (like `member`). It tells Active Directory to **follow the chain of groups** to find the user; for example, if the user is a member of a group that is a member of the group in question.

More information can be found on Microsoft's article on their LDAP [Search Filter Syntax](https://docs.microsoft.com/en-us/windows/desktop/adsi/search-filter-syntax).

## Primary Group

If you read my [What makes a member a member?]({% post_url 2018-06-07-what-makes-a-member %}) article, then you'll know that a user's **primary group is not governed by the `member` attribute** of the group, so the above method won't work if you need to test if a group is the user's primary group. Granted, that's a pretty rare need, so you may be able to ignore this altogether.

But if you do need to find out if a group is a user's primary group, this is how you can do it:

```c#
private static bool IsUserPrimaryGroup(DirectoryEntry user, DirectoryEntry group) {
    user.RefreshCache(new[] {"primaryGroupID", "objectSid"});
    group.RefreshCache(new[] {"objectSid"});

    //Get the SID's as a string
    var userSid =
        new SecurityIdentifier((byte[])user.Properties["objectSid"].Value, 0).ToString();
    var groupSid =
        new SecurityIdentifier((byte[])group.Properties["objectSid"].Value, 0).ToString();

    //Replace the RID portion of the user's SID with the primaryGroupId
    //so we're left with the primary group's SID
    var primaryGroupSid =
        userSid.Remove(userSid.LastIndexOf("-", StringComparison.Ordinal) + 1)
        + user.Properties["primaryGroupId"].Value;

    return groupSid == primaryGroupSid;
}
```
