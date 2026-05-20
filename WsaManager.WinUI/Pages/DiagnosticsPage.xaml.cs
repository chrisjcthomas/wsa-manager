using Microsoft.UI.Xaml.Controls;
using WsaManager_WinUI.ViewModels;

namespace WsaManager_WinUI.Pages;

public sealed partial class DiagnosticsPage : Page
{
    public DiagnosticsPage()
    {
        InitializeComponent();
        DataContext = ViewModel;
    }

    private MainViewModel ViewModel => ((App)Microsoft.UI.Xaml.Application.Current).ViewModel;

    private async void Refresh_Click(object sender, Microsoft.UI.Xaml.RoutedEventArgs e)
    {
        await ViewModel.RefreshReadinessAsync();
    }

    private void Clear_Click(object sender, Microsoft.UI.Xaml.RoutedEventArgs e)
    {
        ViewModel.ClearDiagnostics();
    }
}
