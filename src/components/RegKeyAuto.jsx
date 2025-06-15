const handleRSACheck = async (loginId) => {
  try {
    // Fetch the SID using Get-ADUser
    const response = await fetch('http://sei60590.fg.rbc.com:5000/api/run-powershell', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        script: `Get-ADUser -Filter {SamAccountName -eq '${loginId}'} -Properties SID | Select SID`
      }),
    });

    const data = await response.json();
    const sid = data.output.trim();

    if (response.ok && sid) {
      // Check the DefaultToken registry value using the SID
      const rsaResponse = await fetch('http://sei60590.fg.rbc.com:5000/api/run-powershell', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          script: `Get-ItemProperty -Path "REGISTRY::HKEY_USERS\\${sid}\\SOFTWARE\\RSA\\Software Token\\Library" -Name DefaultToken | Select-Object DefaultToken`
        }),
      });

      const rsaData = await rsaResponse.json();
      const defaultToken = rsaData.output.trim();

      // If DefaultToken is not null, mark RSA as true
      if (defaultToken) {
        setAssets(prevAssets => 
          prevAssets.map((asset) => 
            asset.login_id === loginId ? { ...asset, rsa_complete: true } : asset
          )
        );
      }
    } else {
      console.error('Failed to fetch SID or RSA info');
    }
  } catch (error) {
    console.error('Error:', error);
  }
};



const checkBundles = async () => {
  try {
    // Fetch the installed applications from the registry
    const bundlesResponse = await fetch('http://sei60590.fg.rbc.com:5000/api/run-powershell', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        script: `Get-ItemProperty HKLM:\\Software\\Application_Install\\* | Where-Object { $_APPLICATION_NAME -and $_VERSION_NUMBER } | Select-Object APPLICATION_NAME`
      }),
    });

    const bundlesData = await bundlesResponse.json();
    const installedApps = bundlesData.output.trim().split('\n');

    // Define the list of required applications
    const requiredApps = ["Pulse Secure (Ivanti Secure Access)", "RSA SecurID Software Token", "Webex Teams"];

    // Check if all required applications are installed
    const allRequiredAppsInstalled = requiredApps.every(app => installedApps.includes(app));

    // If all required apps are installed, set Bundles value to true
    if (allRequiredAppsInstalled) {
      setBundles(true);
    } else {
      setBundles(false);
    }
  } catch (error) {
    console.error('Error checking bundles:', error);
  }
};