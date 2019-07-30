---
layout: default
title: "Handling NT Security Descriptor Attributes"
category: "Active Directory"
permalink: /active-directory/:year/:month/:day/:title:output_ext
comments: true
---

# {{page.category}}: {{page.title}}

Active Directory has several attributes that store permissions. The attribute type is called "NT Security Descriptor", or [String(NT-Sec-Desc)](https://docs.microsoft.com/en-us/windows/win32/adschema/s-string-nt-sec-desc). These are the attributes I know of:

- [`fRSRootSecurity`](https://docs.microsoft.com/en-us/windows/win32/adschema/a-frsrootsecurity)
- [`msDFS-LinkSecurityDescriptorv2`](https://docs.microsoft.com/en-us/windows/win32/adschema/a-msdfs-linksecuritydescriptorv2)
- [`msDS-AllowedToActOnBehalfOfOtherIdentity`](https://docs.microsoft.com/en-us/windows/win32/adschema/a-msds-allowedtoactonbehalfofotheridentity)
- [`msDS-GroupMSAMembership`](https://docs.microsoft.com/en-us/windows/win32/adschema/a-msds-groupmsamembership)
- [`nTSecurityDescriptor`](https://docs.microsoft.com/en-us/windows/win32/adschema/a-ntsecuritydescriptor)
- [`pKIEnrollmentAccess`](https://docs.microsoft.com/en-us/windows/win32/adschema/a-pkienrollmentaccess)

The `nTSecurityDescriptor` attribute is a special one. It contains the access permissions for the AD object itself. It's what you see when you look at the 'Security' tab in AD Users and Computers. Most methods of access AD objects will have an easy way to read this data. For example, `DirectoryEntry` has an [`ObjectSecurity`](https://docs.microsoft.com/en-us/dotnet/api/system.directoryservices.directoryentry.objectsecurity) attribute to read this. But there is no obvious way to work with the other ones.

In these examples, I'll focus on the `msDS-AllowedToActOnBehalfOfOtherIdentity` attribute, since this is used when configuring Resource-Based Kerberos Constrained Delegation, which can, for example, help you solve [PowerShell's dreaded double-hop problem](https://blogs.technet.microsoft.com/ashleymcglone/2016/08/30/powershell-remoting-kerberos-double-hop-solved-securely/).

PowerShell makes this easier by making exposing a property called `PrincipalsAllowedToDelegateToAccount` in [`Get-ADUser`](https://docs.microsoft.com/en-us/powershell/module/addsadministration/get-aduser) and [`Set-ADUser`](https://docs.microsoft.com/en-us/powershell/module/addsadministration/set-aduser), which just reads and writes the `msDS-AllowedToActOnBehalfOfOtherIdentity` attribute. Even if we try to access the raw data, it gives us an [`ActiveDirectorySecurity`](https://docs.microsoft.com/en-us/dotnet/api/system.directoryservices.activedirectorysecurity) object. That's handy.

```ps
PS C:\> $u = Get-ADUser SomeUsername -Properties "msDS-AllowedToActOnBehalfOfOtherIdentity"
PS C:\> $u."msDS-AllowedToActOnBehalfOfOtherIdentity".GetType()

IsPublic IsSerial Name                                     BaseType
-------- -------- ----                                     --------
True     False    ActiveDirectorySecurity                  System.Security.AccessControl.DirectoryObjectSecurity
```

But it's not so obvious how to work with this attributes, and the others, in .NET. So here we'll look at two options.

## Getting the value from `DirectoryEntry`

The documentation for [String(NT-Sec-Desc)](https://docs.microsoft.com/en-us/windows/win32/adschema/s-string-nt-sec-desc) says that we'll get **"A COM object that can be cast to an [`IADsSecurityDescriptor`](https://docs.microsoft.com/en-ca/windows/win32/api/iads/nn-iads-iadssecuritydescriptor)."** That's exactly what we see when we try to get the value from `DirectoryEntry`: a COM object.

But to be able to use the `IADsSecurityDescriptor` interface, we will need to add a COM reference in Visual Studio to *Active DS Type Library*:

1. Right-click 'References' in the Solution Explorer
2. Click 'Add Reference...'
3. Click 'COM' on the left side
4. Select "Active DS Type Library" from the list

{% include image.html url="/assets/images/activeds-reference.png" description="Adding a COM reference" %}

> Visual Studio will add a new DLL file to your compiled application called `Interop.ActiveDS.dll`. That is a wrapper around the Windows native `activeds.dll`. Make sure you deploy that DLL with your application.

Now we can do this:

```c#
var act = (IADsSecurityDescriptor)
            user.Properties["msDS-AllowedToActOnBehalfOfOtherIdentity"].Value;
```

You *can* just work with it like that, but it would be a little easier if we get it into a managed type.

Remeber I mentioned that `DirectoryEntry` gives us a handy property to read/write the `ntSecurityDescriptor` attribute called [`ObjectSecurity`](https://docs.microsoft.com/en-us/dotnet/api/system.directoryservices.directoryentry.objectsecurity), which is of type [`ActiveDirectorySecurity`](https://docs.microsoft.com/en-us/dotnet/api/system.directoryservices.activedirectorysecurity). **How does `DirectoryEntry` translate the `ntSecurityDescriptor` attribute into an `ActiveDirectorySecurity` attribute?** And more importantly, how to *we* do it?

The source code for .NET Core is now available, so we can look at [the source code for `DirectoryEntry`](https://github.com/dotnet/corefx/blob/master/src/System.DirectoryServices/src/System/DirectoryServices/DirectoryEntry.cs) to find out. The key is in the [`GetObjectSecurityFromCache`](https://github.com/dotnet/corefx/blob/master/src/System.DirectoryServices/src/System/DirectoryServices/DirectoryEntry.cs#L1078) method. It does a few things:

1. Cast the [`NativeObject`](https://docs.microsoft.com/en-us/dotnet/api/system.directoryservices.directoryentry.nativeobject) property to [`IAdsPropertyList`](https://docs.microsoft.com/en-us/windows/win32/api/iads/nn-iads-iadspropertylist).
2. Call [`IAdsPropertyList::GetPropertyItem`](https://docs.microsoft.com/en-us/windows/win32/api/iads/nf-iads-iadspropertylist-getpropertyitem) to retrieve the attribute, and casts it to [`IADsPropertyEntry`](https://docs.microsoft.com/en-us/windows/win32/api/iads/nn-iads-iadspropertyentry).
3. Cast the first value in the `IADsPropertyEntry.Values` array to  `IADsPropertyValue`.
4. Get the raw byte array of the attribute using `IADsPropertyValue.OctetString`.
5. Use the `byte[]` to create a new `ActiveDirectorySecurity` object.

Unfortunately, we can't do step 5 ourselves because [the constructor that it uses](https://github.com/dotnet/corefx/blob/a10890f4ffe0fadf090c922578ba0e606ebdd16c/src/System.DirectoryServices/src/System/DirectoryServices/ActiveDirectorySecurity.cs#L61) is marked [`internal`](https://docs.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/internal).

```c#
internal ActiveDirectorySecurity(byte[] sdBinaryForm, SecurityMasks securityMask)
    : base(new CommonSecurityDescriptor(true, true, sdBinaryForm, 0))
{
    _securityMaskUsedInRetrieval = securityMask;
}
```

So what's the next best thing?

`ActiveDirectorySecurity` inhertis from [`DirectoryObjectSecurity`](https://docs.microsoft.com/en-us/dotnet/api/system.security.accesscontrol.directoryobjectsecurity), but that's an `abstract` class, so we can't use that. But it does create a [`CommonSecurityDescriptor`](https://docs.microsoft.com/en-us/dotnet/api/system.security.accesscontrol.commonsecuritydescriptor) object from the `byte[]`, and that is something we can do. So we'll do that.

So we just need to get the raw, binary data of the attribute and push it into the constructor for `CommonSecurityDescriptor`. We can replicate steps 1-4 of what `DirectoryEntry.GetObjectSecurityFromCache` does, but it turns out that there's an even easier way.

The [`IADsSecurityUtility`](https://docs.microsoft.com/en-us/windows/win32/api/iads/nn-iads-iadssecurityutility) interface is another COM object, designed to work with security descriptors. One of the methods it provides is [`ConvertSecurityDescriptor `](https://docs.microsoft.com/en-us/windows/win32/api/iads/nf-iads-iadssecurityutility-convertsecuritydescriptor), which **"converts a security descriptor from one format to another"**. We can use that to convert an `IADsSecurityDescriptor` to a `byte[]`.

```c#
var secUtility = new ADsSecurityUtility();
var byteArray = (byte[]) secUtility.ConvertSecurityDescriptor(
                            act,
                            (int)ADS_SD_FORMAT_ENUM.ADS_SD_FORMAT_IID,
                            (int)ADS_SD_FORMAT_ENUM.ADS_SD_FORMAT_RAW
                         );

var security = new CommonSecurityDescriptor(true, true, byteArray, 0);
```

Now you can read/write the security descriptor using the `CommonSecurityDescriptor` object. You'll likely want to work with the [`DiscretionaryAcl`](https://docs.microsoft.com/en-us/dotnet/api/system.security.accesscontrol.commonsecuritydescriptor.discretionaryacl) property.

> Note that you can also create a [`RawSecurityDescriptor`](https://docs.microsoft.com/en-us/dotnet/api/system.security.accesscontrol.rawsecuritydescriptor) object using `new RawSecurityDescriptor(byteArray, 0)`. I really don't know the difference between `RawSecurityDescriptor` and `CommonSecurityDescriptor`. If you know why you would use one over the other, let me know in the comments.

### Writing the value back

If you plan on updating the value, you need to get it back into a `byte[]`. Both `RawSecurityDescriptor` and `CommonSecurityDescriptor` inherit from [`GenericSecurityDescriptor`](https://docs.microsoft.com/en-us/dotnet/api/system.security.accesscontrol.genericsecuritydescriptor), which has a [`GetBinaryForm`](https://docs.microsoft.com/en-us/dotnet/api/system.security.accesscontrol.genericsecuritydescriptor.getbinaryform) method, which will put a binary represenation of the security descriptor into a `byte[]` you already created. For example:

```c#
var descriptor_buffer = new byte[security.BinaryLength];
security.GetBinaryForm(descriptor_buffer, 0);
```

Then you can write it back into the `DirectoryEntry` object:

```c#
user.Properties["msDS-AllowedToActOnBehalfOfOtherIdentity"].Value = descriptor_buffer;
user.CommitChanges();
```

### The code

Here is the code all together. I assume you already have a `DirectoryEntry` object called `user` and you have added a COM reference to "Active DS Type Library" to your project.

```c#
var act = (IADsSecurityDescriptor)
            user.Properties["msDS-AllowedToActOnBehalfOfOtherIdentity"].Value;
var secUtility = new ADsSecurityUtility();
var byteArray = (byte[]) secUtility.ConvertSecurityDescriptor(
                            act,
                            (int) ADS_SD_FORMAT_ENUM.ADS_SD_FORMAT_IID,
                            (int) ADS_SD_FORMAT_ENUM.ADS_SD_FORMAT_RAW
                         );

var security = new CommonSecurityDescriptor(true, true, byteArray, 0);

//modify security object

var descriptor_buffer = new byte[security.BinaryLength];
security.GetBinaryForm(descriptor_buffer, 0);

user.Properties["msDS-AllowedToActOnBehalfOfOtherIdentity"].Value = descriptor_buffer;
user.CommitChanges();
```

## Getting the value from `DirectorySearcher`

There are a few cases where `DirectorySearcher` will give you a value in a different format than `DirectoryEntry`. This is one of those cases. In fact, `DirectorySearcher` makes it even easier on us, since it gives us the raw binary value without a fight. **That means we don't need to add a COM reference to our project.**

This example will find an account with the username `myUsername`, and create a `CommonSecurityDescriptor` object:

```c#
var search = new DirectorySearcher(
    new DirectoryEntry(),
    $"(sAMAccountName=myUsername)"
);
//Tell it that we only want the one attribute returned
search.PropertiesToLoad.Add("msDS-AllowedToActOnBehalfOfOtherIdentity");

var result = search.FindOne();

var security = new CommonSecurityDescriptor(
    true,
    true,
    (byte[]) result.Properties["msDS-AllowedToActOnBehalfOfOtherIdentity"][0],
    0
);
```

If we need to write the value back, we need a `DirectoryEntry` object for the account. We can use [`SearchResult.GetDirectoryEntry()`](https://docs.microsoft.com/en-us/dotnet/api/system.directoryservices.searchresult.getdirectoryentry) to do that:

```c#
var descriptor_buffer = new byte[security.BinaryLength];
security.GetBinaryForm(descriptor_buffer, 0);

var user = result.GetDirectoryEntry();
user.Properties["msDS-AllowedToActOnBehalfOfOtherIdentity"].Value = descriptor_buffer;
user.CommitChanges();
```