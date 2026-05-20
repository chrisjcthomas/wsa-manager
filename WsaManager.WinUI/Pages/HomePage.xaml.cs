using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Windows.ApplicationModel.DataTransfer;
using Windows.Storage;
using Windows.Storage.Pickers;
using WinRT.Interop;
using WsaManager_WinUI.ViewModels;

// To learn more about WinUI, the WinUI project structure,
// and more about our project templates, see: http://aka.ms/winui-project-info.

namespace WsaManager_WinUI.Pages;

public sealed partial class HomePage : Page
{
    private readonly Brush defaultDropZoneBackground = new SolidColorBrush(Microsoft.UI.ColorHelper.FromArgb(0x55, 0x33, 0x4E, 0x49));
    private readonly Brush activeDropZoneBackground = new SolidColorBrush(Microsoft.UI.ColorHelper.FromArgb(0x88, 0x1F, 0x7D, 0x73));
    private readonly Brush defaultDropZoneBorder = new SolidColorBrush(Microsoft.UI.ColorHelper.FromArgb(0xFF, 0xEA, 0xF1, 0xDA));
    private readonly Brush activeDropZoneBorder = new SolidColorBrush(Microsoft.UI.ColorHelper.FromArgb(0xFF, 0x32, 0xF3, 0xE0));

    public HomePage()
    {
        InitializeComponent();
        DataContext = ViewModel;
        ResetDropZone();
    }

    private MainViewModel ViewModel => ((App)Microsoft.UI.Xaml.Application.Current).ViewModel;

    private async void Refresh_Click(object sender, Microsoft.UI.Xaml.RoutedEventArgs e)
    {
        await ViewModel.RefreshReadinessAsync();
    }

    private async void Wake_Click(object sender, Microsoft.UI.Xaml.RoutedEventArgs e)
    {
        await ViewModel.WakeWsaAsync();
    }

    private async void ChooseApks_Click(object sender, Microsoft.UI.Xaml.RoutedEventArgs e)
    {
        var picker = new FileOpenPicker();
        picker.FileTypeFilter.Add(".apk");
        picker.SuggestedStartLocation = PickerLocationId.Desktop;
        InitializeWithWindow.Initialize(picker, WindowNative.GetWindowHandle(((App)Microsoft.UI.Xaml.Application.Current).MainAppWindow));
        var files = await picker.PickMultipleFilesAsync();
        if (files.Count > 0)
        {
            await ViewModel.EnqueueApksAsync(files.Select(file => file.Path));
        }
    }

    private void Dashboard_DragEnter(object sender, Microsoft.UI.Xaml.DragEventArgs e)
    {
        e.AcceptedOperation = DataPackageOperation.Copy;
        DropZone.Background = activeDropZoneBackground;
        DropZone.BorderBrush = activeDropZoneBorder;
        DropZoneTitle.Text = "Drop APKs to install";
        DropZoneSubtitle.Text = "Release your Android package files here.";
    }

    private void Dashboard_DragLeave(object sender, Microsoft.UI.Xaml.DragEventArgs e)
    {
        ResetDropZone();
    }

    private void Dashboard_DragOver(object sender, Microsoft.UI.Xaml.DragEventArgs e)
    {
        e.AcceptedOperation = DataPackageOperation.Copy;
    }

    private async void Dashboard_Drop(object sender, Microsoft.UI.Xaml.DragEventArgs e)
    {
        if (!e.DataView.Contains(StandardDataFormats.StorageItems))
        {
            ResetDropZone();
            return;
        }

        var items = await e.DataView.GetStorageItemsAsync();
        var apkPaths = items.OfType<StorageFile>().Select(file => file.Path).Where(path => path.EndsWith(".apk", StringComparison.OrdinalIgnoreCase)).ToList();
        if (apkPaths.Count > 0)
        {
            await ViewModel.EnqueueApksAsync(apkPaths);
        }

        ResetDropZone();
    }

    private async void ReplaceQueued_Click(object sender, Microsoft.UI.Xaml.RoutedEventArgs e)
    {
        if (sender is Button { Tag: string itemId })
        {
            await ViewModel.ReplaceQueuedAppAsync(itemId);
        }
    }

    private async void SkipQueued_Click(object sender, Microsoft.UI.Xaml.RoutedEventArgs e)
    {
        if (sender is Button { Tag: string itemId })
        {
            await ViewModel.SkipQueuedAppAsync(itemId);
        }
    }

    private void ResetDropZone()
    {
        DropZone.Background = defaultDropZoneBackground;
        DropZone.BorderBrush = defaultDropZoneBorder;
        DropZoneTitle.Text = "Add APK files";
        DropZoneSubtitle.Text = "Drag and drop Android packages here, or choose files from your computer.";
    }
}
