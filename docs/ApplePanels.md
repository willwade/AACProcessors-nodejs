## Apple Panels 

This is not exactly a aac tool. but  can be used as open

File format:

in a folder called '*.ascconfig'

we have Contents/

in this folder we have a file called 'Info.plist'

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>ASCConfigurationDisplayName</key>
	<string>Default Panels</string>
	<key>ASCConfigurationIdentifier</key>
	<string>49F8121E-736B-4FC2-BEA8-209C3EF54ED9</string>
	<key>ASCConfigurationProductSupportType</key>
	<string>VirtualKeyboard</string>
	<key>ASCConfigurationVersion</key>
	<string>7.1</string>
	<key>CFBundleDevelopmentRegion</key>
	<string>en</string>
	<key>CFBundleIdentifier</key>
	<string>com.apple.AssistiveControl.panel.newDoc.defs</string>
	<key>CFBundleName</key>
	<string>Assistive Control Panels</string>
	<key>CFBundleShortVersionString</key>
	<string>2.0</string>
	<key>CFBundleVersion</key>
	<string>383</string>
	<key>NSHumanReadableCopyright</key>
	<string>Copyright © 2016-2024 Apple Inc. All Rights Reserved.</string>
</dict>
</plist>
```

then Resources/ (so Contents/Resources/)
We have 'AssetIndex.plist' 

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict/>
</plist>
```
 
 and then PanelDefinitions.plist 

 ``xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Panels</key>
	<dict>
		<key>USER.82FC8D2C-6991-41E9-B534-78E52F101AC7</key>
		<dict>
			<key>DisplayOrder</key>
			<integer>1</integer>
			<key>GlidingLensSize</key>
			<integer>5</integer>
			<key>HasTransientPosition</key>
			<false/>
			<key>HideHome</key>
			<false/>
			<key>HideMinimize</key>
			<false/>
			<key>HidePanelAdjustments</key>
			<false/>
			<key>HideSwitchDock</key>
			<false/>
			<key>HideSwitchDockContextualButtons</key>
			<false/>
			<key>HideTitlebar</key>
			<false/>
			<key>ID</key>
			<string>USER.82FC8D2C-6991-41E9-B534-78E52F101AC7</string>
			<key>Name</key>
			<string>New Panel</string>
			<key>PanelObjects</key>
			<array>
				<dict>
					<key>Actions</key>
					<array>
						<dict>
							<key>ActionParam</key>
							<dict>
								<key>CharString</key>
								<string>Enter this Text</string>
								<key>isStickyKey</key>
								<false/>
							</dict>
							<key>ActionRecordedOffset</key>
							<real>0.0</real>
							<key>ActionType</key>
							<string>ActionPressKeyCharSequence</string>
							<key>ID</key>
							<string>Action.A502D835-D3B7-4253-80A3-97FE4B433EBE</string>
						</dict>
					</array>
					<key>ButtonType</key>
					<integer>0</integer>
					<key>DisplayColor</key>
					<string>0.041 0.375 0.998 1.000</string>
					<key>DisplayImageResourceIsTemplate</key>
					<false/>
					<key>DisplayImageWeight</key>
					<string>FontWeightRegular</string>
					<key>DisplayText</key>
					<string>enter text button</string>
					<key>FontSize</key>
					<real>12</real>
					<key>ID</key>
					<string>Button.186CD086-698B-496F-8496-1326D141833C</string>
					<key>PanelObjectType</key>
					<string>Button</string>
					<key>Rect</key>
					<string>{{0, 0}, {100, 25}}</string>
				</dict>
				<dict>
					<key>Actions</key>
					<array>
						<dict>
							<key>ActionParam</key>
							<dict>
								<key>PanelID</key>
								<string>ACSH.homePanel.primary.dwell</string>
							</dict>
							<key>ActionRecordedOffset</key>
							<real>0.0</real>
							<key>ActionType</key>
							<string>ActionOpenPanel</string>
							<key>ID</key>
							<string>Action.6C2E1080-B39F-491A-8F8A-F60460A35732</string>
						</dict>
					</array>
					<key>ButtonType</key>
					<integer>0</integer>
					<key>DisplayColor</key>
					<string>0.161 0.781 0.197 1.000</string>
					<key>DisplayImageResourceIsTemplate</key>
					<false/>
					<key>DisplayImageWeight</key>
					<string>FontWeightRegular</string>
					<key>DisplayText</key>
					<string>nav button</string>
					<key>FontSize</key>
					<real>12</real>
					<key>ID</key>
					<string>Button.8CD3879D-A328-47FB-BB7E-BB0E1973AFE8</string>
					<key>PanelObjectType</key>
					<string>Button</string>
					<key>Rect</key>
					<string>{{105, 0}, {100, 25}}</string>
				</dict>
				<dict>
					<key>ButtonType</key>
					<integer>0</integer>
					<key>DisplayImageResource</key>
					<string>DoubleClick</string>
					<key>DisplayImageResourceIsTemplate</key>
					<false/>
					<key>DisplayImageWeight</key>
					<string>FontWeightRegular</string>
					<key>DisplayText</key>
					<string>button with image</string>
					<key>FontSize</key>
					<real>12</real>
					<key>ID</key>
					<string>Button.36BCE679-1DF3-422F-80BB-F37F2E8527F2</string>
					<key>PanelObjectType</key>
					<string>Button</string>
					<key>Rect</key>
					<string>{{215, 0}, {100, 25}}</string>
				</dict>
				<dict>
					<key>Actions</key>
					<array>
						<dict>
							<key>ActionRecordedOffset</key>
							<real>0.0</real>
						</dict>
					</array>
					<key>ButtonType</key>
					<integer>0</integer>
					<key>DisplayImageResourceIsTemplate</key>
					<false/>
					<key>DisplayImageWeight</key>
					<string>FontWeightRegular</string>
					<key>DisplayText</key>
					<string>Current Text</string>
					<key>FontSize</key>
					<real>12</real>
					<key>ID</key>
					<string>Button.39446632-CBCB-4D6D-945A-8F413DB611FA</string>
					<key>LocalizedDisplayText</key>
					<string>defaultButton.hoverText</string>
					<key>PanelObjectType</key>
					<string>Button</string>
					<key>Rect</key>
					<string>{{325, 0}, {100, 25}}</string>
				</dict>
				<dict>
					<key>ButtonType</key>
					<integer>0</integer>
					<key>DisplayImageResourceIsTemplate</key>
					<false/>
					<key>DisplayImageWeight</key>
					<string>FontWeightRegular</string>
					<key>DisplayText</key>
					<string>untitled</string>
					<key>FontSize</key>
					<real>12</real>
					<key>ID</key>
					<string>Button.711EC127-B802-49DD-AC6A-2996D8DBCADF</string>
					<key>PanelObjectType</key>
					<string>Button</string>
					<key>Rect</key>
					<string>{{0, 30}, {100, 25}}</string>
				</dict>
				<dict>
					<key>ButtonType</key>
					<integer>0</integer>
					<key>DisplayImageResourceIsTemplate</key>
					<false/>
					<key>DisplayImageWeight</key>
					<string>FontWeightRegular</string>
					<key>DisplayText</key>
					<string>untitled</string>
					<key>FontSize</key>
					<real>12</real>
					<key>ID</key>
					<string>Button.52D329DC-F607-4C62-9598-2C5B9F14D9B7</string>
					<key>PanelObjectType</key>
					<string>Button</string>
					<key>Rect</key>
					<string>{{105, 30}, {100, 25}}</string>
				</dict>
				<dict>
					<key>ButtonType</key>
					<integer>0</integer>
					<key>DisplayImageResourceIsTemplate</key>
					<false/>
					<key>DisplayImageWeight</key>
					<string>FontWeightRegular</string>
					<key>DisplayText</key>
					<string>untitled</string>
					<key>FontSize</key>
					<real>12</real>
					<key>ID</key>
					<string>Button.E48FC5B5-D13C-4776-A7FB-9E8BDBAF1988</string>
					<key>PanelObjectType</key>
					<string>Button</string>
					<key>Rect</key>
					<string>{{215, 30}, {100, 25}}</string>
				</dict>
				<dict>
					<key>ButtonType</key>
					<integer>0</integer>
					<key>DisplayImageResourceIsTemplate</key>
					<false/>
					<key>DisplayImageWeight</key>
					<string>FontWeightRegular</string>
					<key>DisplayText</key>
					<string>untitled</string>
					<key>FontSize</key>
					<real>12</real>
					<key>ID</key>
					<string>Button.DD4A146E-35FA-4CFE-81F7-C01AB245C955</string>
					<key>PanelObjectType</key>
					<string>Button</string>
					<key>Rect</key>
					<string>{{325, 30}, {100, 25}}</string>
				</dict>
			</array>
			<key>ProductSupportType</key>
			<string>All</string>
			<key>Rect</key>
			<string>{{15, 75}, {425, 55}}</string>
			<key>ScanStyle</key>
			<integer>0</integer>
			<key>ShowPanelLocationString</key>
			<string>CustomPanelList</string>
			<key>UsesPinnedResizing</key>
			<false/>
		</dict>
	</dict>
	<key>ToolbarOrdering</key>
	<dict>
		<key>ToolbarIdentifiersAfterBasePanel</key>
		<array/>
		<key>ToolbarIdentifiersPriorToBasePanel</key>
		<array>
			<string>ACSH.systemPanel.dynamic.bestDwellActions</string>
			<string>ACSH.systemPanel.dynamic.hoverText</string>
			<string>ACSH.systemPanel.dynamic.bestSuggestions</string>
			<string>ACSH.systemPanel.dynamic.bestFunctionKeys</string>
		</array>
	</dict>
</dict>
</plist>

```