# Line Up

Rearranges selected lines in ascending order of length, from the shortest at the top to the longest at the bottom.

Perfect for `using` statements, imports, variable declarations, or anywhere else the order of lines doesn't matter.

```csharp
using System.Threading.Tasks;                 using System;
using System;                           →     using System.Linq;
using System.Collections.Generic;             using System.Threading.Tasks;
using System.Linq;                            using System.Collections.Generic;
```

## Usage

1. Select the lines you want to line up. A partially selected line counts as a whole line.
2. Press <kbd>Ctrl</kbd>+<kbd>R</kbd>, <kbd>Ctrl</kbd>+<kbd>R</kbd>, or run **Line Up: Line Up Selected Lines** from the Command Palette.

Notes:

- Length ignores indentation and trailing whitespace.
- Lines of equal length keep their original order.
- Works with multiple selections; each selection is lined up separately.

## Lining up C# using directives on save

When you save a C# file that has unsaved changes, Line Up automatically lines up its `using` directives, no selection needed. Each group of consecutive usings is lined up on its own, so blank lines between groups are kept.

This only happens on an explicit save (not auto-save). To turn it off, set `lineUp.usingsOnSave` to `false`.

## Lining up a whole project or solution

Run either command from the Command Palette:

- **Line Up: Line Up Using Directives in C# Files in Current Project**
- **Line Up: Line Up Using Directives in C# Files in Solution**

The project (`.csproj`) or solution (`.sln` or `.slnx`) is the nearest one above the file you're editing. If no file is open, Line Up looks in the workspace and asks you to choose when there are several.

A project's C# files are all the `.cs` files under its folder, except those in `bin`, `obj`, hidden folders and nested projects. A solution includes every C# project it lists. Files open in an editor are changed there, so you can undo; other files are updated on disk.

## Changing the shortcut

Open **Keyboard Shortcuts**, search for `line-up.lineUp`, and assign the key binding you like.
