using Microsoft.UI.Xaml;
using WsaManager.Core;
using WsaManager_WinUI.ViewModels;
using Microsoft.UI.Dispatching;

// To learn more about WinUI, the WinUI project structure,
// and more about our project templates, see: http://aka.ms/winui-project-info.

namespace WsaManager_WinUI;

/// <summary>
/// Provides application-specific behavior to supplement the default Application class.
/// </summary>
public partial class App : Application
{
    private Window? _window;
    public MainViewModel ViewModel { get; private set; } = null!;
    public Window MainAppWindow => _window ?? throw new InvalidOperationException("Main window has not been created.");
    
    /// <summary>
    /// Initializes the singleton application object.  This is the first line of authored code
    /// executed, and as such is the logical equivalent of main() or WinMain().
    /// </summary>
    public App()
    {
        InitializeComponent();
    }

    /// <summary>
    /// Invoked when the application is launched.
    /// </summary>
    /// <param name="args">Details about the launch request and process.</param>
    protected override void OnLaunched(Microsoft.UI.Xaml.LaunchActivatedEventArgs args)
    {
        ViewModel = CreateViewModel();
        _window = new MainWindow();
        _window.Activate();
    }

    private MainViewModel CreateViewModel()
    {
        var appData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "WSA Manager WinUI");
        var settings = new SettingsStore(appData);
        var diagnostics = new DiagnosticsService();
        var runner = new ProcessCommandRunner();
        var adb = new AdbService(settings, diagnostics, runner);
        var wsa = new WsaService(settings, adb, diagnostics, runner);
        var queue = new InstallQueueService(adb, wsa, settings, diagnostics);
        var windowsCleaner = new WindowsAppRegistrationCleaner(runner, diagnostics);
        var windowsCatalog = new WindowsWsaAppCatalog(runner, diagnostics);
        var catalog = new CatalogService(adb, settings, diagnostics, windowsCleaner, windowsCatalog);
        return new MainViewModel(settings, diagnostics, wsa, queue, catalog, DispatcherQueue.GetForCurrentThread());
    }
}
