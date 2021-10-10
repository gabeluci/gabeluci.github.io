---
layout: default
title: "Better performance"
category: "Active Directory"
permalink: /active-directory/:year/:month/:day/:title:output_ext
comments: true
---

# {{page.category}}: {{page.title}}

One common complaint that pops up when programming against Active Directory is that **it is slooowww**.

When it comes to programming against AD, or any LDAP directory for that matter, two things will slow down performance more than anything else:

1. The number of requests made to the server, and
2. The amount of data returned.

Let's talk about ways you a can minimize both.

While this article concentrates on .NET and specifically C#, it's really just using LDAP in the background. So the principles apply to any programming language that can make LDAP queries.

## Don't use `System.DirectoryServices.AccountManagement`

The [`AccountManagement`](https://docs.microsoft.com/en-us/dotnet/api/system.directoryservices.accountmanagement) namespace (classes like [`UserPrincipal`](https://docs.microsoft.com/en-us/dotnet/api/system.directoryservices.accountmanagement.userprincipal) and [`PrincipalSearcher`](https://docs.microsoft.com/en-us/dotnet/api/system.directoryservices.accountmanagement.principalsearcher)) is a wrapper around the [`System.DirectoryServices`](https://docs.microsoft.com/en-us/dotnet/api/system.directoryservices) namespace ([`DirectoryEntry`](https://docs.microsoft.com/en-us/dotnet/api/system.directoryservices.directoryentry) and [`DirectorySearcher`](https://docs.microsoft.com/en-us/dotnet/api/system.directoryservices.directorysearcher)). It's **designed to make things easier** on you. To some extent that is certainly true, but **it comes at the cost of control**. **It is almost always slower** than using the `System.DirectoryServices` classes directly.

## Use `System.DirectoryServices`

**You have much more control** over how many network requests are made, and how much data gets retrieved by using `DirectoryEntry` and `DirectorySearcher` directly. However, you do need to be careful in how you use them, since it's easy to write code that performs poorly. We'll talk about some principles here that really apply to LDAP in general and not just .NET or Active Directory.

### If you ask for nothing, you get everything

LDAP allows you to specify which attributes you want returned for each result returned in a search. The `DirectorySearcher` class has a property called [`PropertiesToLoad`](https://docs.microsoft.com/en-us/dotnet/api/system.directoryservices.directorysearcher.propertiestoload) for this. But here's the trick: **if you don't specify any attributes, it will return *every* attribute** (except constructed attributes).

At best this is a slight waste of bandwidth. At worst, this can get very expensive. For example, if your organization uses the `thumbnailPhoto` attribute to store pictures of everyone (this is what will show up in Outlook, for example), then that can be up to 100kB of data that is returned for every result found, regardless of if you actually use that information.

You won't really notice anything if you're just searching for one user. But if you are, say, building a report of every user object on your domain, then this will add up!

Here is a simple example of returning the email address (and *only* the email address) of every user on the domain:

```c#
public IEnumerable<string> EveryEmailAddress() {
    var search = new DirectorySearcher(new DirectoryEntry()) {
        PageSize = 1000,
        Filter = "(objectClass=user)"
    };
    
    //make sure only the mail attribute is sent back
    search.PropertiesToLoad.Add("mail");
    
    using (var results = search.FindAll()) {
        foreach (SearchResult result in results) {
            if (result.Properties.Contains("mail")) {
                yield return (string) result.Properties["mail"][0];
            }
        }
    }
}
```

The lesson? **Always specify the attributes you want returned in a search.**

### If you ask for one thing, you get everything

This is the same principal as above, but with `DirectoryEntry`. Each instance of `DirectoryEntry` holds a cache of the attributes. When you access the [`Properties`](https://docs.microsoft.com/en-us/dotnet/api/system.directoryservices.directoryentry.properties) collection to read an attribute, it checks the cache first to see if it already has the value. If it doesn't, **it retrieves every attribute** (except constructed attributes).

To avoid this, **use [`RefreshCache()`](https://docs.microsoft.com/en-us/dotnet/api/system.directoryservices.directoryentry.refreshcache#System_DirectoryServices_DirectoryEntry_RefreshCache_System_String___)** to load specific properties into the cache before you use them. This example shows how to retrieve *only the `mail` and `displayName` attributes* before using them:

```c#
de.RefreshCache(new [] { "mail", "displayName" });
var email = (string) de.Properties["mail"]?.Value;
var displayName = (string) de.Properties["displayName"]?.Value;
```

### Don't use `GetDirectoryEntry()`

Because of the two points above, **don't use [`SearchResult.GetDirectoryEntry()`](https://docs.microsoft.com/en-us/dotnet/api/system.directoryservices.searchresult.getdirectoryentry) just to read attributes** from an object. Take the following code for example:

```c#
//This is Bad™
public IEnumerable<string> EveryEmailAddress() {
    var search = new DirectorySearcher(new DirectoryEntry()) {
        PageSize = 1000,
        Filter = "(&(objectClass=user)(objectCategory=person))"
    };
    
    using (var results = search.FindAll()) {
        foreach (SearchResult result in results) {
            var de = result.GetDirectoryEntry();
            
            yield return (string) de.Properties["mail"].Value;
        }
    }
}
```

We know that the search will return every attribute for every user found. Then we're using `GetDirectoryEntry()` to create a new `DirecotryEntry` object **with an empty cache**. So once we do `de.Properties["mail"]`, it goes back out to AD and gets every attribute *again*.

Even if we apply the two rules above, we will still be making two network requests when we only need to make one. We can instead use the value returned during the search: `result.Properties["mail"][0]`.

The only reason to use `GetDirectoryEntry()` is **if you're going to modify the object**.

### Clean up after yourself

The documentation of [`SearchResultCollection`](https://docs.microsoft.com/en-us/dotnet/api/system.directoryservices.searchresultcollection) says:

> Due to implementation restrictions, the SearchResultCollection class cannot release all of its unmanaged resources when it is garbage collected. To prevent a memory leak, you must call the Dispose method when the SearchResultCollection object is no longer needed.

For this reason, you will see in all my examples that I **put the call to `DirectorySearcher.FindAll()` in a `using` block**.

Although `DirectoryEntry` also implements `IDisposable`, you don't *normally* need to bother disposing it. Garbage collection does a good job of it. However, **if you are looping over a large number of accounts** and creating a new `DirectoryEntry` each time, garbage collection won't have time to run until the loop finishes. That means that all of those `DirectoryEntry` objects will be adding up in memory and can slow down your application due to your application having to constantly ask the OS for more memory.

An example of this is the code in my [Find all the members of a group]({% post_url 2018-11-30-find-all-members-of-group %}) post where it loops through the `memberOf` attribute and creates a new `DirectoryEntry` object to check if it's a group. **In these cases, put the `DirectoryEntry` in a `using` block**.

## Ask for as much as you can at a time

Let's say you have a list of usernames and you need to get the email address for all of them. You could make a separate search for each username, or you could combine all the usernames into one LDAP query and find them all at once:

```
(|(sAMAccountName=username1)(sAMAccountName=username2)(sAMAccountName=username3)(sAMAccountName=username4))
```

How long can you make your query? Well, there is no hard limit, but the *entire LDAP request* (not just the query string, but everything that goes along with it) [must be less than 10MB](https://stackoverflow.com/a/556711/1202807). It is unlikely you'd ever hit that, but if you're worried, break them into chunks (of maybe 50) and search for each chunk at a time.

As an example, here is a method that will take a collection of usernames and get all their email addresses in blocks of 50 at a time:

```c#
public IEnumerable<string> GetEmailAddresses(IEnumerable<string> usernames) {
    var filter = new StringBuilder();
    var numUsernames = 0;
    
    var e = usernames.GetEnumerator();
    var hasMore = e.MoveNext();
    
    while (hasMore) {
        var username = e.Current;
        filter.Append($"(sAMAccountName={username})");
        numUsernames++;
        
        hasMore = e.MoveNext();
        if (numUsernames == 50 || !hasMore) {
            var search = new DirectorySearcher(new DirectoryEntry()) {
                PageSize = 1000,
                Filter = $"(&(objectClass=user)(objectCategory=person)(|{filter}))"
            };
            search.PropertiesToLoad.Add("mail");
            
            using (var results = search.FindAll()) {
                foreach (SearchResult result in results) {
                    yield return (string) result.Properties["mail"][0];
                }
            }
            filter.Clear();
            numUsernames = 0;
        }
    }
}
```

You do have to be aware that because you're doing a search doesn't necessarily mean you will get a result. So you may decide you need to verify that you indeed got all the results you expected. You could just compare numbers (if I asked for 100 accounts, did I actually get 100 back?) or you could change this to return a `Dictionary<string, string>` with the `sAMAccountName` as the key and the `mail` attribute as the value so you can check which ones are missing. But all of that verification is done in memory and it still *waaayy* faster than doing a separate search for each account.
