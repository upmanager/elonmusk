import { useMetaMask } from "metamask-react";
import { useEffect, useRef, useState, useCallback } from 'react';
import Web3 from "web3";
import TwitterLogin from "../components/TwitterLogin.js";
import { checkFollow, checkUser, getScreenName, saveUser } from "../services/api";
import './styles.css';

const FOLLOW_SATUS = {
  DISABLE: -1,
  LOGIN: 0,
  FOLLOW: 1,
  FOLLOWED: 2,
  UNFOLLOWED: 3,
  CONNECTED: 4
}

function Home() {
  const { status, connect, account } = useMetaMask();
  const web3 = useRef(new (Web3)(window.ethereum)).current;
  const [twitterUser, setTwitterUser] = useState()
  const [followStatus, setFollowStatus] = useState(FOLLOW_SATUS.DISABLE)
  const [oauthToken, setOauthToken] = useState(null)

  const [signed, setSigned] = useState(false)

  useEffect(() => {
    if (!account) return setSigned(false);
    var accounts = getSigned();
    var exists = accounts.filter(item => item.toLowerCase() === account.toLowerCase()).length > 0;
    setSigned(exists);
  }, [account])

  useEffect(() => {
    if (!account || !signed) {
      setFollowStatus(FOLLOW_SATUS.DISABLE)
      return;
    }
    checkUser(account)
      .then(res => {
        if (res.exists) {
          setTwitterUser(res.name);
          setFollowStatus(FOLLOW_SATUS.CONNECTED)
          alert("You are already registered for camp")
        } else {
          setFollowStatus(FOLLOW_SATUS.LOGIN)
        }
      })
      .catch(err => {
        console.log(err);
        setFollowStatus(FOLLOW_SATUS.LOGIN)
      })
  }, [account, signed])

  const verifyFolled = useCallback(async () => {
    if (!twitterUser) return setFollowStatus(FOLLOW_SATUS.LOGIN)
    if (followStatus === FOLLOW_SATUS.UNFOLLOWED) return setFollowStatus(FOLLOW_SATUS.FOLLOW)

    const response = await checkFollow(twitterUser, oauthToken.oauth_token, oauthToken.oauth_token_secret).catch(console.log)
    if (response?.success && response.followed) return setFollowStatus(FOLLOW_SATUS.FOLLOWED)

    setFollowStatus(FOLLOW_SATUS.UNFOLLOWED)
  }, [followStatus, oauthToken, twitterUser])

  useEffect(() => {
    if (followStatus !== FOLLOW_SATUS.FOLLOW) return
    if (!oauthToken) return;
    if (!twitterUser) return;
    verifyFolled()
  }, [oauthToken, twitterUser, followStatus, verifyFolled])

  const authHandler = async (err, data) => {
    if (err) {
      console.log(err);
      alert("Twitter login error");
      setFollowStatus(FOLLOW_SATUS.LOGIN)
      return;
    }
    const { oauth_token, oauth_token_secret } = data;
    setOauthToken({ oauth_token, oauth_token_secret })

    const response = await getScreenName(oauth_token, oauth_token_secret).catch(console.log)
    if (response?.success) {
      setTwitterUser(response.screen_name)
      setFollowStatus(FOLLOW_SATUS.FOLLOW)
      return;
    }
    setFollowStatus(FOLLOW_SATUS.LOGIN)
  };

  const onSuccess = () => {
    if (followStatus !== FOLLOW_SATUS.FOLLOWED) return;

    saveUser(account, twitterUser)
      .then(res => {
        alert("successfully entered whitelist");
        window.location.href = "https://campcosmos.io"
      })
      .catch(err => {
        console.log(err);
        alert("user save error")
      })
  }

  const getSigned = () => JSON.parse(window.localStorage.getItem('accounts')) || [];

  const addSignedAddress = (addr) => {
    var accounts = getSigned();
    accounts.push(addr)
    window.localStorage.setItem('accounts', JSON.stringify(accounts))
  }

  const ActionItem = ({ icon, content, title, desc, connected, error, button, disabled, onAction = () => { }, actionComponent }) => {
    return (
      <div className={`contain ${disabled ? 'disabled' : ''} ${error ? 'error' : ''}`}>
        <div className='description'>
          <img src={icon} alt={title} />
          <div className="title">
            <h3>{content ? content : title}</h3>
            <span>{desc}</span>
          </div>
          {connected &&
            <>
              <img src={'https://freenft.xyz/_next/static/media/green-check.b46832bf.svg'} alt={'CONNECTED'}
                style={{ width: 20, height: 20 }} />
              <span className="connected">Connected</span>
            </>
          }
        </div>

        {actionComponent ?
          actionComponent()
          :
          button ?
            <div className='action' onClick={disabled || !onAction ? () => { } : onAction}>
              {button}
            </div>
            :
            <></>
        }
      </div>
    )
  }
  const generateKey = (length) => {
    var nonce = "";
    var allowed = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (var i = 0; i < length; i++) {
      nonce = nonce.concat(allowed.charAt(Math.floor(Math.random() * allowed.length)));
    }
    return nonce;
  }
  const signMessage = async () => {
    const nonce = generateKey(10);
    const message = `This is the official message, Your nonce is: ${nonce}`;
    const signatureHash = await web3.eth.personal.sign(message, account)
    if (signatureHash) {
      const address = web3.eth.accounts.recover(message, signatureHash)
      if (address.toLowerCase() === account.toLowerCase()) {
        setFollowStatus(FOLLOW_SATUS.LOGIN)
        setSigned(true);
        addSignedAddress(address)
      }
    }
  }

  const connected = status === 'connected';

  const isredirectScreen = window.location.href.includes("oauth_token")
  return (
    <div className="App">
      {isredirectScreen && <div>Redirecting....</div>}
      <div className={`container ${isredirectScreen ? 'redirecting' : ''}`}>
        <h3>{status === 'unavailable' ? 'please use a desktop metamask browser' : ''}</h3>
        <ActionItem
          icon={'https://www.freenft.xyz/_next/static/media/active.0e50e7a2.svg'}
          title={connected ? signed ? `GM, ${account.slice(0, 4) + '...' + account.slice(account.length - 4, account.length)}` : 'Sign a message' : 'Connect your wallet'}
          desc={connected ? signed ? `Wallet Connected` : 'prove this is your wallet' : 'Get on the camplist'}
          button={connected ? signed ? false : 'SIGN' : 'Connect'}
          connected={connected && signed}
          onAction={() => {
            if (connected) {
              signMessage()
            } else {
              setSigned(false);
              connect();
            }
          }}
        />
        <ActionItem
          icon={followStatus === FOLLOW_SATUS.DISABLE ?
            'https://www.freenft.xyz/_next/static/media/inactive.47228843.svg'
            :
            'https://www.freenft.xyz/_next/static/media/active.1d43c8ff.svg'
          }
          error={followStatus === FOLLOW_SATUS.UNFOLLOWED}

          content={<div>Follow <a href="https://twitter.com/campcosmos" target="_blank" rel="noreferrer">camp cosmos</a></div>}
          desc={twitterUser ? `Connected @${twitterUser}` : 'And connect your twitter'}

          button={
            followStatus === FOLLOW_SATUS.UNFOLLOWED ?
              'You must follow the indicated twitter account(s) TRY AGAIN'
              :
              followStatus === FOLLOW_SATUS.FOLLOW ?
                'Verify'
                :
                followStatus === FOLLOW_SATUS.DISABLE ?
                  'Connect & Verify'
                  :
                  followStatus === FOLLOW_SATUS.CONNECTED ?
                    'You are already registered for camp'
                    :
                    ''
          }
          connected={followStatus === FOLLOW_SATUS.FOLLOWED || followStatus === FOLLOW_SATUS.CONNECTED}
          actionComponent={followStatus === FOLLOW_SATUS.LOGIN ? () => (
            <TwitterLogin
              className={'action'}
              authCallback={authHandler}
              children={<div>{"Connect & Verify"}</div>}
            />
          ) : null}
          onAction={() => verifyFolled()}
          disabled={followStatus === FOLLOW_SATUS.DISABLE || followStatus === FOLLOW_SATUS.CONNECTED}
        />
        <div className={`contain ${followStatus !== FOLLOW_SATUS.FOLLOWED ? 'disabled' : ''}`}>
          <div className='action' onClick={onSuccess}>
            <div>{"Submit"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;