if [ -f /tmp/.balloon.env.json ]; then
  mv /tmp/.balloon.env.json /opt/Balloon/resources/resources/env.json
  chmod 0644 /opt/Balloon/resources/resources/env.json
fi
