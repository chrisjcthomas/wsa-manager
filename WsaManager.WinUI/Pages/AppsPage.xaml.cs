using Microsoft.UI.Xaml.Controls;
using WsaManager_WinUI.ViewModels;

namespace WsaManager_WinUI.Pages;

public sealed partial class AppsPage : Page
{
    public AppsPage()
    {
        InitializeComponent();
        DataContext = ViewModel;
    }

    private MainViewModel ViewModel => ((App)Microsoft.UI.Xaml.Application.Current).ViewModel;

    private async void Refresh_Click(object sender, Microsoft.UI.Xaml.RoutedEventArgs e)
    {
        await ViewModel.RefreshAppsAsync();
    }

    private async void Uninstall_Click(object sender, Microsoft.UI.Xaml.RoutedEventArgs e)
    {
        if (sender is not Button { Tag: string packageName })
        {
            return;
        }

        var dialog = new ContentDialog
        {
            Title = "Remove this app from WSA?",
            Content = packageName,
            PrimaryButtonText = "Uninstall",
            CloseButtonText = "Cancel",
            XamlRoot = XamlRoot
        };

        if (await dialog.ShowAsync() == ContentDialogResult.Primary)
        {
            await ViewModel.UninstallAppAsync(packageName);
        }
    }
}
