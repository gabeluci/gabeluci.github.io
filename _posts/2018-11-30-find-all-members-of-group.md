---
layout: default
title: "Find all the members of a group"
category: "Active Directory"
permalink: /active-directory/:year/:month/:day/:title:output_ext
comments: true
---

# {{page.category}}: {{page.title}}

This article will discuss finding all the members of a group. While the code is in C#, the principals can be applied to any language that can make LDAP queries.

But before learning that, it's helpful to know just what makes a user a member of a group. If you haven't read that article yet, do that first:

> [What makes a member a member?]({% post_url 2018-06-07-what-makes-a-member %})

## The code

### `System.DirectoryServices.AccountManagement`

If you have read any of my other articles, you'll know I'm not a fan of the `AccountManagement` namespace. It can be simpler, but comes at a cost of performance and sometimes functionality. But here's an example anyway (assuming you already have a `GroupPrincipal` object):

```c#
public static IEnumerable<string> GetGroupMemberList(GroupPrincipal group, bool recursive = false) {
    using (var memberPrincipals = group.GetMembers(recursive)) {
        foreach (Principal member in memberPrincipals) {
            yield return member.SamAccountName;
        }
    }
}
```

It's pretty short! But there are a few caveats:

1. There is a lot more network traffic going on in behind than you actually need (it pulls in all attributes that have a value even though we're only using `SamAccountName`)
2. It will crash if the group contains members from external trusted domains (i.e. Foreign Security Principals)

### `System.DirectoryServices`

It is more code, but if you use `DirectoryEntry`, you get far better performance, and you can make it *actually work* for Foreign Security Principals.

These examples will output the accounts in `DOMAIN\username` format, but you can modify for whatever you need.

#### Single-forest environments

First, here is an example if you are working only in a **single-forest** environment (where you won't have any Foreign Security Principals).

If you want to expand groups that are inside this group, pass `true` for the `recursive` parameter. These examples assume you already have a `DirectoryEntry` object for the group.

```c#
public static IEnumerable<string> GetGroupMemberList(DirectoryEntry group, bool recursive = false) {
    var members = new List<string>();

    group.RefreshCache(new[] { "member" });

    while (true) {
        var memberDns = group.Properties["member"];
        foreach (string member in memberDns) {
            using (var memberDe = new DirectoryEntry($"LDAP://{member.Replace("/", "\\/")}")) {
                memberDe.RefreshCache(new[] { "objectClass", "msDS-PrincipalName", "cn" });

                if (recursive && memberDe.Properties["objectClass"].Contains("group")) {
                    members.AddRange(GetGroupMemberList(memberDe, true));
                } else {
                    var username = memberDe.Properties["msDS-PrincipalName"].Value.ToString();
                    if (!string.IsNullOrEmpty(username)) {
                        members.Add(username);
                    }
                }
            }
        }

        if (memberDns.Count == 0) break;

        try {
            group.RefreshCache(new[] {$"member;range={members.Count}-*"});
        } catch (COMException e) {
            if (e.ErrorCode == unchecked((int) 0x80072020)) { //no more results
                break;
            }
            throw;
        }
    }
    return members;
}
```

#### Finding foreign members

If you need to account for Foreign Security Principals, they are a little tricky. FSP's contain the SID of the object on the external domain. You can bind directly to an object using the SID by using `LDAP://<SID={sid}>`, but for objects on an external domain, you also have to include the DNS name of the domain: `LDAP://domain.com/<SID={sid}>`. Because of that, **we need to know the DNS name of the domain** ahead of time.

The SID will actually tell you the domain because the first part of the SID is specific to the domain, whereas the very last section of numbers in the SID is specific to the object. So in this method, we first look up all the domain trusts and create a mapping table between each domain's SID and its DNS name.

```c#
public static IEnumerable<string> GetGroupMemberList(DirectoryEntry group, bool recursive = false, Dictionary<string, string> domainSidMapping = null) {
    var members = new List<string>();

    group.RefreshCache(new[] { "member", "canonicalName" });

    if (domainSidMapping == null) {
        //Find all the trusted domains and create a dictionary that maps the domain's SID to its DNS name
        var groupCn = (string) group.Properties["canonicalName"].Value;
        var domainDns = groupCn.Substring(0, groupCn.IndexOf("/", StringComparison.Ordinal));

        var domain = Domain.GetDomain(new DirectoryContext(DirectoryContextType.Domain, domainDns));
        var trusts = domain.GetAllTrustRelationships();

        domainSidMapping = new Dictionary<string, string>();

        foreach (TrustRelationshipInformation trust in trusts) {
            using (var trustedDomain = new DirectoryEntry($"LDAP://{trust.TargetName}")) {
                try {
                    trustedDomain.RefreshCache(new [] {"objectSid"});
                    var domainSid = new SecurityIdentifier((byte[]) trustedDomain.Properties["objectSid"].Value, 0).ToString();
                    domainSidMapping.Add(domainSid, trust.TargetName);
                } catch (Exception e) {
                    //This can happen if you're running this with credentials
                    //that aren't trusted on the other domain or if the domain
                    //can't be contacted
                    throw new Exception($"Can't connect to domain {trust.TargetName}: {e.Message}", e);
                }
            }
        }
    }

    while (true) {
        var memberDns = group.Properties["member"];
        foreach (string member in memberDns) {
            using (var memberDe = new DirectoryEntry($"LDAP://{member.Replace("/", "\\/")}")) {
                memberDe.RefreshCache(new[] { "objectClass", "msDS-PrincipalName", "cn" });

                if (recursive && memberDe.Properties["objectClass"].Contains("group")) {
                    members.AddRange(GetGroupMemberList(memberDe, true, domainSidMapping));
                } else if (memberDe.Properties["objectClass"].Contains("foreignSecurityPrincipal")) {
                    //User is on a trusted domain
                    var foreignUserSid = memberDe.Properties["cn"].Value.ToString();
                    //The SID of the domain is the SID of the user minus the last block of numbers
                    var foreignDomainSid = foreignUserSid.Substring(0, foreignUserSid.LastIndexOf("-"));
                    if (domainSidMapping.TryGetValue(foreignDomainSid, out var foreignDomainDns)) {
                        using (var foreignUser = new DirectoryEntry($"LDAP://{foreignDomainDns}/<SID={foreignUserSid}>")) {
                            foreignUser.RefreshCache(new[] { "msDS-PrincipalName" });
                            members.Add(foreignUser.Properties["msDS-PrincipalName"].Value.ToString());
                        }
                    } else {
                        //unknown domain
                        members.Add(foreignUserSid);
                    }
                } else {
                    var username = memberDe.Properties["msDS-PrincipalName"].Value.ToString();
                    if (!string.IsNullOrEmpty(username)) {
                        members.Add(username);
                    }
                }
            }
        }

        if (memberDns.Count == 0) break;

        try {
            group.RefreshCache(new[] {$"member;range={members.Count}-*"});
        } catch (COMException e) {
            if (e.ErrorCode == unchecked((int) 0x80072020)) { //no more results
                break;
            }
            throw;
        }
    }
    return members;
}
```

#### Primary groups

Neither of these methods will find users who have this group as the primary group. If you need that, here is a method that does it. If need be, you can combine this method with one of the ones above.

As discussed in [my other article]({% post_url 2018-06-07-what-makes-a-member %}), this relationship is determined by the `primaryGroupId` attribute on the user account, so that's what we search for. These users will always be on the same domain as the group.

```c#
public static IEnumerable<string> GetPrimaryGroupMemberList(DirectoryEntry group) {
    group.RefreshCache(new[] { "distinguishedName", "primaryGroupToken" });
    
    var groupDn = (string) group.Properties["distinguishedName"].Value;
    var ds = new DirectorySearcher(
        new DirectoryEntry($"LDAP://{groupDn.Substring(groupDn.IndexOf("DC=", StringComparison.Ordinal))}"),
        $"(&(objectClass=user)(primaryGroupId={group.Properties["primaryGroupToken"].Value}))",
        new [] { "msDS-PrincipalName" })
    {
        PageSize = 1000
    };
    
    using (var primaryMembers = ds.FindAll()) {
        foreach (SearchResult primaryMember in primaryMembers) {
            yield return (string) primaryMember.Properties["msDS-PrincipalName"][0];
        }
    }
}
```