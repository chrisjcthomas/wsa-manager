using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using WsaManager_WinUI.Pages;

// To learn more about WinUI, the WinUI project structure,
// and more about our project templates, see: http://aka.ms/winui-project-info.

namespace WsaManager_WinUI;

public sealed partial class MainWindow : Window
{
    private readonly DispatcherTimer readinessTimer = new() { Interval = TimeSpan.FromSeconds(6) };

    public MainWindow()
    {
        InitializeComponent();

        ExtendsContentIntoTitleBar = true;
        SetTitleBar(AppTitleBar);
        AppWindow.TitleBar.PreferredHeightOption = TitleBarHeightOption.Tall;
        AppWindow.SetIcon("Assets/AppIcon.ico");
        NavFrame.Navigate(typeof(HomePage));
        _ = ((App)Application.Current).ViewModel.InitializeAsync();
        readinessTimer.Tick += ReadinessTimer_Tick;
        readinessTimer.Start();
    }

    private async void ReadinessTimer_Tick(object? sender, object e)
    {
        await ((App)Application.Current).ViewModel.RefreshReadinessIfIdleAsync();
    }

    private void TitleBar_PaneToggleRequested(TitleBar sender, object args)
    {
        NavView.IsPaneOpen = !NavView.IsPaneOpen;
    }

    private void TitleBar_BackRequested(TitleBar sender, object args)
    {
        NavFrame.GoBack();
    }

    private void NavView_SelectionChanged(NavigationView sender, NavigationViewSelectionChangedEventArgs args)
    {
        if (args.IsSettingsSelected)
        {
            NavFrame.Navigate(typeof(SettingsPage));
        }
        else if (args.SelectedItem is NavigationViewItem item)
        {
            switch (item.Tag)
            {
                case "home":
                    NavFrame.Navigate(typeof(HomePage));
                    break;
                case "install":
                    NavFrame.Navigate(typeof(InstallPage));
                    break;
                case "apps":
                    NavFrame.Navigate(typeof(AppsPage));
                    break;
                case "diagnostics":
                    NavFrame.Navigate(typeof(DiagnosticsPage));
                    break;
                default:
                    throw new InvalidOperationException($"Unknown navigation item tag: {item.Tag}");
            }
        }
    }
}
