using Microsoft.UI.Xaml.Controls;
using Windows.Storage.Pickers;
using WinRT.Interop;
using WsaManager_WinUI.ViewModels;

namespace WsaManager_WinUI.Pages;

public sealed partial class InstallPage : Page
{
    public InstallPage()
    {
        InitializeComponent();
        DataContext = ViewModel;
    }

    private MainViewModel ViewModel => ((App)Microsoft.UI.Xaml.Application.Current).ViewModel;

    private async void ChooseApks_Click(object sender, Microsoft.UI.Xaml.RoutedEventArgs e)
    {
        var picker = new FileOpenPicker();
        picker.FileTypeFilter.Add(".apk");
        picker.SuggestedStartLocation = PickerLocationId.Downloads;
        InitializeWithWindow.Initialize(picker, WindowNative.GetWindowHandle(((App)Microsoft.UI.Xaml.Application.Current).MainAppWindow));
        var files = await picker.PickMultipleFilesAsync();
        if (files.Count > 0)
        {
            await ViewModel.EnqueueApksAsync(files.Select(file => file.Path));
        }
    }
}
