---
layout: default
title: "Handling NT Security Descriptor attributes in C#"
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

The `nTSecurityDescriptor` attribute is a special one. It contains the access permissions for the AD object itself. It's what you see when you look at the 'Security' tab in AD Users and Computers. Most methods of accessing AD objects will have an easy way to read this data. For example, `DirectoryEntry` has an [`ObjectSecurity`](https://docs.microsoft.com/en-us/dotnet/api/system.directoryservices.directoryentry.objectsecurity) attribute to read this. But there is no obvious way to work with the other ones.

In these examples, I'll focus on the `msDS-AllowedToActOnBehalfOfOtherIdentity` attribute, since this is used when configuring Resource-Based Kerberos Constrained Delegation, which can, for example, help you solve [PowerShell's dreaded double-hop problem](https://blogs.technet.microsoft.com/ashleymcglone/2016/08/30/powershell-remoting-kerberos-double-hop-solved-securely/).

PowerShell makes this easier by exposing a property called `PrincipalsAllowedToDelegateToAccount` in [`Get-ADUser`](https://docs.microsoft.com/en-us/powershell/module/addsadministration/get-aduser) and [`Set-ADUser`](https://docs.microsoft.com/en-us/powershell/module/addsadministration/set-aduser), which just reads and writes the `msDS-AllowedToActOnBehalfOfOtherIdentity` attribute. Even if we try to access the raw data, it gives us an [`ActiveDirectorySecurity`](https://docs.microsoft.com/en-us/dotnet/api/system.directoryservices.activedirectorysecurity) object. That's handy.

```
PS C:\> $u = Get-ADUser SomeUsername -Properties "msDS-AllowedToActOnBehalfOfOtherIdentity"
PS C:\> $u."msDS-AllowedToActOnBehalfOfOtherIdentity".GetType()

IsPublic IsSerial Name                                     BaseType
-------- -------- ----                                     --------
True     False    ActiveDirectorySecurity                  System.Security.AccessControl.DirectoryObjectSecurity
```

But it's not so obvious how to work with this attribute (and the others) in .NET. So here we'll look at two options.

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

Remeber I mentioned that `DirectoryEntry` gives us a handy property to read/write the `ntSecurityDescriptor` attribute called [`ObjectSecurity`](https://docs.microsoft.com/en-us/dotnet/api/system.directoryservices.directoryentry.objectsecurity), which is of type [`ActiveDirectorySecurity`](https://docs.microsoft.com/en-us/dotnet/api/system.directoryservices.activedirectorysecurity). Can we use that?

The [only public constructor for `ActiveDirectorySecurity`](https://docs.microsoft.com/en-us/dotnet/api/system.directoryservices.activedirectorysecurity.-ctor) just creates an empty object. That's not helpful. There is a [`SetSecurityDescriptorBinaryForm`](https://docs.microsoft.com/en-us/dotnet/api/system.security.accesscontrol.objectsecurity.setsecuritydescriptorbinaryform) method that could help us, but only if we had the security descriptor in a byte array. Can we get that?

The [`IADsSecurityUtility`](https://docs.microsoft.com/en-us/windows/win32/api/iads/nn-iads-iadssecurityutility) interface is another COM object, designed to work with security descriptors. One of the methods it provides is [`ConvertSecurityDescriptor `](https://docs.microsoft.com/en-us/windows/win32/api/iads/nf-iads-iadssecurityutility-convertsecuritydescriptor), which **"converts a security descriptor from one format to another"**. We can use that to convert an `IADsSecurityDescriptor` to a `byte[]`.

```c#
var secUtility = new ADsSecurityUtility();
var byteArray = (byte[]) secUtility.ConvertSecurityDescriptor(
                            act,
                            (int)ADS_SD_FORMAT_ENUM.ADS_SD_FORMAT_IID,
                            (int)ADS_SD_FORMAT_ENUM.ADS_SD_FORMAT_RAW
                         );

var adSecurity = new ActiveDirectorySecurity();
adSecurity.SetSecurityDescriptorBinaryForm(byteArray);
```

Now you can read/write the security descriptor using the `ActiveDirectorySecurity` object. You'll likely want to use the [`GetAccessRules`](https://docs.microsoft.com/en-us/dotnet/api/system.security.accesscontrol.directoryobjectsecurity.getaccessrules) method. For example, this code will loop through the access rules and just print them out to the console:

```c#
foreach (ActiveDirectoryAccessRule rule in adSecurity.GetAccessRules(true, false, typeof(SecurityIdentifier))) {
    Console.WriteLine($"{rule.IdentityReference} {rule.AccessControlType} {rule.ActiveDirectoryRights} {rule.ObjectType}");
}
```

The [`ObjectType`](https://docs.microsoft.com/en-us/dotnet/api/system.security.accesscontrol.objectaccessrule.objecttype) is a `Guid` that refers to either a [specific attribute](https://docs.microsoft.com/en-us/windows/win32/adschema/attributes-all), a [property set](https://docs.microsoft.com/en-us/windows/win32/adschema/property-sets) (a way of assigning permissions to a group of attributes at once), or an [extended right](https://docs.microsoft.com/en-us/windows/win32/adschema/extended-rights) (if the [`ActiveDirectoryRights`](https://docs.microsoft.com/en-us/dotnet/api/system.directoryservices.activedirectoryaccessrule.activedirectoryrights) property is set to `ExtendedRight`).

### Writing the value back

If you plan on updating the value, you need to get it back into a `byte[]`. Fortunately, that's made easy with the [`GetSecurityDescriptorBinaryForm`](https://docs.microsoft.com/en-us/dotnet/api/system.security.accesscontrol.objectsecurity.getsecuritydescriptorbinaryform) method. For example:

```c#
var newByteArray = adSecurity.GetSecurityDescriptorBinaryForm();
```

Then you can write it back into the `DirectoryEntry` object:

```c#
user.Properties["msDS-AllowedToActOnBehalfOfOtherIdentity"].Value = newByteArray;
user.CommitChanges();
```

### The code

Here is the code all together. This assumes you already have a `DirectoryEntry` object called `user` and you have added a COM reference to "Active DS Type Library" to your project.

```c#
var act = (IADsSecurityDescriptor)
            user.Properties["msDS-AllowedToActOnBehalfOfOtherIdentity"].Value;
var secUtility = new ADsSecurityUtility();
var byteArray = (byte[]) secUtility.ConvertSecurityDescriptor(
                            act,
                            (int) ADS_SD_FORMAT_ENUM.ADS_SD_FORMAT_IID,
                            (int) ADS_SD_FORMAT_ENUM.ADS_SD_FORMAT_RAW
                         );

var adSecurity = new ActiveDirectorySecurity();
adSecurity.SetSecurityDescriptorBinaryForm(byteArray);

//modify security object here

var newByteArray = adSecurity.GetSecurityDescriptorBinaryForm();

user.Properties["msDS-AllowedToActOnBehalfOfOtherIdentity"].Value = newByteArray;
user.CommitChanges();
```

## Getting the value from `DirectorySearcher`

There are a few cases (in general) where `DirectorySearcher` will gives you values in a different format than `DirectoryEntry`. This is one of those cases. In fact, `DirectorySearcher` makes it even easier on us, since it gives us the raw binary value without a fight. **That means we don't need to add a COM reference to our project.**

This example will find an account with the username `myUsername`, and create an `ActiveDirectorySecurity` object:

```c#
var search = new DirectorySearcher(
    new DirectoryEntry(),
    $"(sAMAccountName=myUsername)"
);
//Tell it that we only want the one attribute returned
search.PropertiesToLoad.Add("msDS-AllowedToActOnBehalfOfOtherIdentity");

var result = search.FindOne();

var adSecurity = new ActiveDirectorySecurity();
adSecurity.SetSecurityDescriptorBinaryForm((byte[]) result.Properties["msDS-AllowedToActOnBehalfOfOtherIdentity"][0]);
```

If we need to write the value back, we need a `DirectoryEntry` object for the account. We can use [`SearchResult.GetDirectoryEntry()`](https://docs.microsoft.com/en-us/dotnet/api/system.directoryservices.searchresult.getdirectoryentry) to do that:

```c#
var newByteArray = adSecurity.GetSecurityDescriptorBinaryForm();

var user = result.GetDirectoryEntry();
user.Properties["msDS-AllowedToActOnBehalfOfOtherIdentity"].Value = newByteArray;
user.CommitChanges();
```
