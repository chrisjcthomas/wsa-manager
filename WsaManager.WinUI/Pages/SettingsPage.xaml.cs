// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using Microsoft.UI.Xaml.Controls;
using Windows.Storage.Pickers;
using WinRT.Interop;
using WsaManager_WinUI.ViewModels;

// To learn more about WinUI, the WinUI project structure,
// and more about our project templates, see: http://aka.ms/winui-project-info.

namespace WsaManager_WinUI.Pages;

public sealed partial class SettingsPage : Page
{
    public SettingsPage()
    {
        InitializeComponent();
        DataContext = ViewModel;
    }

    private MainViewModel ViewModel => ((App)Microsoft.UI.Xaml.Application.Current).ViewModel;

    private async void ChooseAdb_Click(object sender, Microsoft.UI.Xaml.RoutedEventArgs e)
    {
        var picker = new FileOpenPicker();
        picker.FileTypeFilter.Add(".exe");
        picker.SuggestedStartLocation = PickerLocationId.ComputerFolder;
        InitializeWithWindow.Initialize(picker, WindowNative.GetWindowHandle(((App)Microsoft.UI.Xaml.Application.Current).MainAppWindow));
        var file = await picker.PickSingleFileAsync();
        if (file is not null)
        {
            AdbPathBox.Text = file.Path;
            await ViewModel.SaveAdbPathAsync(file.Path);
        }
    }

    private async void SaveAdb_Click(object sender, Microsoft.UI.Xaml.RoutedEventArgs e)
    {
        await ViewModel.SaveAdbPathAsync(AdbPathBox.Text);
    }

    private async void SaveEndpoint_Click(object sender, Microsoft.UI.Xaml.RoutedEventArgs e)
    {
        await ViewModel.SaveManualEndpointAsync(EndpointBox.Text);
    }
}
